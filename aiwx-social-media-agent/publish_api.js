const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);
let platform = '';
let text = '';
let image = '';
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--platform') platform = args[++i].toLowerCase();
  else if (args[i] === '--text') text = args[++i];
  else if (args[i] === '--image') image = args[++i];
  else if (args[i] === '--dry-run') dryRun = true;
}

if (!platform || !text) {
  console.error(JSON.stringify({ success: false, error: 'Platform and text are required.' }));
  process.exit(1);
}

// Helper to check if image is a local file
function isLocalImage(img) {
  if (!img) return false;
  const lower = img.toLowerCase();
  return !lower.startsWith('http://') && !lower.startsWith('https://') || lower.includes('localhost') || lower.includes('127.0.0.1');
}

// HTTP request helper
function apiRequest(method, url, headers = {}, body = null, isBinary = false) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    // Format body
    let postData = '';
    if (body) {
      if (isBinary) {
        postData = body;
      } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        postData = new URLSearchParams(body).toString();
      } else {
        postData = typeof body === 'string' ? body : JSON.stringify(body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody ? JSON.parse(responseBody) : {}
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: { rawText: responseBody }
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

// PUT binary helper specifically for LinkedIn image uploads
function putBinaryFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png', // LinkedIn supports image/png, image/jpeg, etc.
        'Content-Length': stats.size
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`Binary upload failed with status ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    fileStream.pipe(req);
  });
}

function fallbackToHeadless(plat = platform) {
  console.log(`[API] Triggering Headless Browser Post Fallback for platform: ${plat}...`);
  const headlessArgs = ['publish_headless.js', '--platform', plat, '--text', text];
  if (image) headlessArgs.push('--image', image);
  if (dryRun) headlessArgs.push('--dry-run');

  return new Promise((resolve) => {
    execFile('node', headlessArgs, { cwd: __dirname }, (err, stdout, stderr) => {
      if (stdout) console.log(stdout.trim());
      if (stderr) console.error(stderr.trim());
      if (err) {
        console.log(JSON.stringify({ success: false, error: err.message, log: stdout }));
        if (platform === 'all') {
          resolve({ success: false, error: err.message });
        } else {
          process.exit(1);
        }
      } else {
        resolve({ success: true, platform: plat });
      }
    });
  });
}

async function publishSingle(targetPlatform) {
  if (dryRun) {
    console.log(`[DRY RUN] [API] Would post to ${targetPlatform} via Official API.`);
    console.log(`[DRY RUN] Content: "${text.substring(0, 60)}..."`);
    if (image) console.log(`[DRY RUN] Image: ${image}`);
    console.log(JSON.stringify({ success: true, platform: targetPlatform, dryRun: true, status: 'API Dry-run successful' }));
    return;
  }

  // PLATFORM: LINKEDIN
  if (targetPlatform === 'linkedin') {
    const credsPathLI = path.join(__dirname, 'config', 'linkedin_credentials.json');
    if (!fs.existsSync(credsPathLI)) {
      console.log("[API] LinkedIn credentials file not found. Falling back to Headless posting...");
      await fallbackToHeadless(targetPlatform);
      return;
    }

    const credsLI = JSON.parse(fs.readFileSync(credsPathLI, 'utf8'));
    const liToken = credsLI.accessToken;

    if (!liToken) {
      console.log("[API] LinkedIn access token is missing. Falling back to Headless posting...");
      await fallbackToHeadless(targetPlatform);
      return;
    }

    try {
      let personUrn = credsLI.personUrn;
      
      // If URN is not saved, query it on the fly
      if (!personUrn) {
        console.log("[API] LinkedIn URN not cached. Fetching URN from profile API...");
        let meRes = await apiRequest('GET', 'https://api.linkedin.com/v2/userinfo', {
          'Authorization': `Bearer ${liToken}`
        });

        if (meRes.statusCode !== 200) {
          meRes = await apiRequest('GET', 'https://api.linkedin.com/v2/me', {
            'Authorization': `Bearer ${liToken}`
          });
        }

        if (meRes.statusCode === 200) {
          const profile = meRes.body;
          personUrn = profile.sub ? `urn:li:person:${profile.sub}` : `urn:li:person:${profile.id}`;
          // Cache it
          credsLI.personUrn = personUrn;
          fs.writeFileSync(credsPathLI, JSON.stringify(credsLI, null, 2), 'utf8');
        } else {
          throw new Error(`OIDC /userinfo and /me access denied (Status ${meRes.statusCode}). Profile scopes may be missing on app.`);
        }
      }

      let assetId = null;

      // Handle image upload if provided
      if (image) {
        let absoluteImagePath = image;
        if (!isLocalImage(image)) {
          console.log(`[API] LinkedIn: Downloading image from URL on the fly...`);
          const tempPath = path.join(__dirname, 'temp_linkedin_upload.jpg');
          await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(tempPath);
            https.get(image, response => {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve();
              });
            }).on('error', err => {
              fs.unlink(tempPath, () => {});
              reject(err);
            });
          });
          absoluteImagePath = tempPath;
        } else {
          absoluteImagePath = path.isAbsolute(image) ? image : path.join(__dirname, image);
        }

        if (!fs.existsSync(absoluteImagePath)) {
          throw new Error(`Local image not found at path: ${absoluteImagePath}`);
        }

        console.log("[API] LinkedIn: Step 1: Registering media asset...");
        const registerBody = {
          "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": personUrn,
            "supportedUploadMechanism": ["SYNCHRONOUS_UPLOAD"]
          }
        };

        const regRes = await apiRequest('POST', 'https://api.linkedin.com/v2/assets?action=registerUpload', {
          'Authorization': `Bearer ${liToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }, registerBody);

        if (regRes.statusCode !== 200) {
          throw new Error(`Media registration failed: ${JSON.stringify(regRes.body)}`);
        }

        const uploadUrl = regRes.body.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadMechanism"].uploadUrl;
        assetId = regRes.body.value.asset;

        console.log(`[API] LinkedIn: Step 2: Uploading image file binary payload to: ${uploadUrl.substring(0, 50)}...`);
        await putBinaryFile(uploadUrl, absoluteImagePath);
        console.log(`[API] LinkedIn: Step 3: Asset successfully uploaded (ID: ${assetId})`);
      }

      // Create UGC Post
      console.log("[API] LinkedIn: Step 4: Creating post...");
      const ugcBody = {
        "author": personUrn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
          "com.linkedin.ugc.ShareContent": {
            "shareCommentary": {
              "text": text
            },
            "shareMediaCategory": assetId ? "IMAGE" : "NONE"
          }
        },
        "visibility": {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      if (assetId) {
        ugcBody.specificContent["com.linkedin.ugc.ShareContent"].media = [
          {
            "status": "READY",
            "description": {
              "text": "Post image"
            },
            "media": assetId,
            "title": {
              "text": "Campaign Post Visual"
            }
          }
        ];
      }

      const postRes = await apiRequest('POST', 'https://api.linkedin.com/v2/ugcPosts', {
        'Authorization': `Bearer ${liToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }, ugcBody);

      if (postRes.statusCode !== 201) {
        throw new Error(`LinkedIn post failed (Status ${postRes.statusCode}): ${JSON.stringify(postRes.body)}`);
      }

      console.log(JSON.stringify({ success: true, platform: 'linkedin', postId: postRes.body.id }));
    } catch (err) {
      console.error(`[API ERROR] LinkedIn API Posting Failed: ${err.message}`);
      console.log("[API] Attempting fallback to Headless Browser Direct Posting...");
      return await fallbackToHeadless(targetPlatform);
    } finally {
      if (image && !isLocalImage(image)) {
        const tempPath = path.join(__dirname, 'temp_linkedin_upload.jpg');
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    }
    return;
  }

  // PLATFORMS: FACEBOOK, INSTAGRAM, THREADS
  const credsPathMeta = path.join(__dirname, 'config', 'meta_credentials.json');
  if (!fs.existsSync(credsPathMeta)) {
    console.log("[API] Meta credentials file not found. Falling back to Headless posting...");
    await fallbackToHeadless(targetPlatform);
    return;
  }

  const credsMeta = JSON.parse(fs.readFileSync(credsPathMeta, 'utf8'));

  // If there's a local image, we MUST use headless for Meta since Meta APIs require a publicly accessible image URL
  if (image && isLocalImage(image)) {
    console.log("[API] Local image path detected. Meta APIs require public image hosting. Falling back to Headless Browser posting...");
    await fallbackToHeadless(targetPlatform);
    return;
  }

  try {
    if (targetPlatform === 'facebook') {
      const pageId = credsMeta.pageId;
      const userToken = credsMeta.userAccessToken;
      if (!pageId || !userToken) throw new Error('Missing pageId or userAccessToken');

      console.log(`[API] Fetching Page Access Token for Page ID: ${pageId}...`);
      const pageTokenRes = await apiRequest('GET', `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userToken}`);
      
      if (pageTokenRes.body.error) throw new Error(`Failed to get page token: ${pageTokenRes.body.error.message}`);
      const pageAccessToken = pageTokenRes.body.access_token;

      let postUrl = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      let postBody = {
        message: text,
        access_token: pageAccessToken
      };

      if (image) {
        postUrl = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        postBody = {
          caption: text,
          url: image,
          access_token: pageAccessToken
        };
      }

      console.log(`[API] Publishing post to Facebook Page...`);
      const postRes = await apiRequest('POST', postUrl, { 'Content-Type': 'application/x-www-form-urlencoded' }, postBody);
      if (postRes.body.error) throw new Error(postRes.body.error.message);

      const result = { success: true, platform: 'facebook', postId: postRes.body.id || postRes.body.post_id };
      console.log(JSON.stringify(result));
      return result;
    } 
    else if (targetPlatform === 'instagram') {
      const igAccountId = credsMeta.instagramAccountId;
      const userToken = credsMeta.userAccessToken;
      if (!igAccountId || !userToken) throw new Error('Missing instagramAccountId or userAccessToken');

      if (!image) {
        throw new Error('Instagram requires an image or video; text-only posting is not supported.');
      }

      console.log(`[API] Step 1: Creating Instagram media container...`);
      const containerRes = await apiRequest('POST', `https://graph.facebook.com/v19.0/${igAccountId}/media`, { 'Content-Type': 'application/x-www-form-urlencoded' }, {
        image_url: image,
        caption: text,
        access_token: userToken
      });

      if (containerRes.body.error) throw new Error(containerRes.body.error.message);
      const creationId = containerRes.body.id;

      console.log(`[API] Step 1.5: Waiting for Instagram to process the media...`);
      let status = 'IN_PROGRESS';
      let retries = 10;
      while (status === 'IN_PROGRESS' && retries > 0) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await apiRequest('GET', `https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${userToken}`);
        status = statusRes.body.status_code || 'FINISHED';
        console.log(`  [API] Instagram container status: ${status} (Retries left: ${retries})`);
        if (status === 'ERROR') {
          throw new Error(`Instagram media processing failed: ${statusRes.body.status || 'Unknown error'}`);
        }
        retries--;
      }

      console.log(`[API] Step 2: Publishing Instagram media container (ID: ${creationId})...`);
      const publishRes = await apiRequest('POST', `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, { 'Content-Type': 'application/x-www-form-urlencoded' }, {
        creation_id: creationId,
        access_token: userToken
      });

      if (publishRes.body.error) throw new Error(publishRes.body.error.message);
      const result = { success: true, platform: 'instagram', postId: publishRes.body.id };
      console.log(JSON.stringify(result));
      return result;
    } 
    else if (targetPlatform === 'threads') {
      const threadsToken = credsMeta.threadsAccessToken;
      if (!threadsToken) throw new Error('Missing threadsAccessToken');

      console.log(`[API] Fetching Threads User ID...`);
      const meRes = await apiRequest('GET', `https://graph.threads.net/v1.0/me?fields=id&access_token=${threadsToken}`);
      if (meRes.body.error) throw new Error(`Failed to fetch Threads User ID: ${meRes.body.error.message}`);
      const threadsUserId = meRes.body.id;

      console.log(`[API] Step 1: Creating Threads media container...`);
      const containerBody = {
        media_type: image ? 'IMAGE' : 'TEXT',
        text: text,
        access_token: threadsToken
      };
      if (image) {
        containerBody.image_url = image;
      }

      const containerRes = await apiRequest('POST', `https://graph.threads.net/v1.0/${threadsUserId}/threads`, { 'Content-Type': 'application/x-www-form-urlencoded' }, containerBody);
      if (containerRes.body.error) throw new Error(containerRes.body.error.message);
      const creationId = containerRes.body.id;

      console.log(`[API] Step 1.5: Waiting for Threads to process the media...`);
      let status = 'IN_PROGRESS';
      let retries = 10;
      while (status === 'IN_PROGRESS' && retries > 0) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await apiRequest('GET', `https://graph.threads.net/v1.0/${creationId}?fields=status,error_message&access_token=${threadsToken}`);
        status = statusRes.body.status || 'FINISHED';
        console.log(`  [API] Threads container status: ${status} (Retries left: ${retries})`);
        if (status === 'ERROR') {
          throw new Error(`Threads media processing failed: ${statusRes.body.error_message || 'Unknown error'}`);
        }
        retries--;
      }

      console.log(`[API] Step 2: Publishing Threads media container (ID: ${creationId})...`);
      const publishRes = await apiRequest('POST', `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`, { 'Content-Type': 'application/x-www-form-urlencoded' }, {
        creation_id: creationId,
        access_token: threadsToken
      });

      if (publishRes.body.error) throw new Error(publishRes.body.error.message);
      const result = { success: true, platform: 'threads', postId: publishRes.body.id };
      console.log(JSON.stringify(result));
      return result;
    }
  } catch (err) {
    console.error(`[API ERROR] API Posting Failed: ${err.message}`);
    console.log("[API] Attempting fallback to Headless Browser Direct Posting...");
    return await fallbackToHeadless(targetPlatform);
  }
}

async function publish() {
  if (platform === 'all') {
    const platforms = ['facebook', 'instagram', 'threads', 'linkedin'];
    console.log(`[API] Starting unified publication for all platforms: ${platforms.join(', ')}`);
    const results = {};
    for (const p of platforms) {
      console.log(`\n========================================`);
      console.log(`🚀 PUBLISHING TO PLATFORM: ${p.toUpperCase()}`);
      console.log(`========================================`);
      try {
        const res = await publishSingle(p);
        results[p] = res || { success: true };
      } catch (err) {
        results[p] = { success: false, error: err.message };
      }
    }
    console.log(`\n========================================`);
    console.log(`📊 UNIFIED PUBLISHING RESULTS SUMMARY:`);
    console.log(JSON.stringify(results, null, 2));
    console.log(`========================================`);
  } else {
    await publishSingle(platform);
  }
}

publish();
