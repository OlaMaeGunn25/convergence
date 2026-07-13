// calendar_ui.js - Extracted scheduling and calendar display logic

function setCalendarMonth(month) {
  activeMonth = month;
  document.getElementById('btnJune').classList.toggle('active', month === 'June');
  document.getElementById('btnJuly').classList.toggle('active', month === 'July');
  document.getElementById('btnAugust').classList.toggle('active', month === 'August');
  document.getElementById('calendarMonthLabel').innerText = month + ' 2026';
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';
  const posts = getHubPosts();
  
  let paddingCells = 3;
  let totalDays = 31;
  if (activeMonth === 'June') {
    paddingCells = 1;
    totalDays = 30;
  } else if (activeMonth === 'August') {
    paddingCells = 6;
    totalDays = 31;
  }
  
  // Render padding cells
  for (let i = 0; i < paddingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.style.opacity = '0.15';
    cell.style.cursor = 'default';
    grid.appendChild(cell);
  }
  
  // Render actual days
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    const post = posts.find(p => p.month === activeMonth && p.dayNum === day);
    cell.innerHTML = `<span class="day-number">${day}</span>`;
    
    if (post) {
      cell.classList.add('active-post-day');
      if (post.id === selectedPostId) {
        cell.classList.add('selected');
      }
      
      let indicatorClass = 'pending';
      let symbol = '⏰';
      
      if (post.status === 'APPROVED') {
        indicatorClass = 'approved';
        symbol = '⏰';
      } else if (post.status === 'PUBLISHING') {
        indicatorClass = 'publishing';
        symbol = '⚙️';
      } else if (post.status === 'PUBLISHED') {
        indicatorClass = 'published';
        symbol = '✓';
      } else if (post.status === 'FAILED') {
        indicatorClass = 'failed';
        symbol = '❌';
      }
      
      cell.innerHTML += `
        <div class="post-indicator ${indicatorClass}" title="${post.title}">
          ${symbol} ${post.title}
          <div class="post-time-meta" style="font-size:0.65rem; opacity:0.85; margin-top:3px; font-weight:500; display:flex; gap:3px; flex-direction:column;">
            <div>🕒 Threads: 9:00 AM EST</div>
            <div>🕒 LinkedIn/FB: 10:00 AM EST</div>
            <div>🕒 Instagram: 6:00 PM EST</div>
          </div>
        </div>
      `;
      
      cell.onclick = () => selectPost(post.id);
    }
    grid.appendChild(cell);
  }
}

function selectPost(id) {
  selectedPostId = id;
  renderCalendar();
  loadPostPreview();
}

function switchPlatform(platform) {
  currentPlatform = platform;
  document.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
  // Safe execution support for event bindings
  if (typeof event !== 'undefined' && event.target) {
    event.target.classList.add('active');
  } else {
    // Fallback search
    const tab = Array.from(document.querySelectorAll('.platform-tab')).find(t => t.innerText.toLowerCase().includes(platform));
    if (tab) tab.classList.add('active');
  }
  loadPostPreviewText();
}

function loadPostPreview() {
  const posts = getHubPosts();
  const post = posts.find(p => p.id === selectedPostId);
  if (!post) return;

  document.getElementById('postDate').innerText = `Date: ${post.date}`;
  document.getElementById('postCampaign').innerText = `Campaign: ${post.campaign}`;
  document.getElementById('previewImg').src = post.image;
  document.getElementById('previewImgName').innerText = post.image;
  document.getElementById('previewImgAlt').innerText = post.imgAlt;
  
  const badge = document.getElementById('postStatusBadge');
  badge.innerText = post.status;
  
  if (post.status === 'APPROVED' || post.status === 'PUBLISHED') {
    badge.style.background = 'rgba(16,185,129,0.2)';
    badge.style.color = 'var(--success-color)';
  } else if (post.status === 'PUBLISHING') {
    badge.style.background = 'rgba(245,158,11,0.2)';
    badge.style.color = 'var(--warning-color)';
  } else if (post.status === 'FAILED') {
    badge.style.background = 'rgba(239,68,68,0.2)';
    badge.style.color = 'var(--danger-color)';
  } else {
    badge.style.background = 'rgba(255,255,255,0.05)';
    badge.style.color = 'var(--text-secondary)';
  }

  loadPostPreviewText();
  renderComments();
}

function loadPostPreviewText() {
  const posts = getHubPosts();
  const post = posts.find(p => p.id === selectedPostId);
  if (!post) return;

  const copyBox = document.getElementById('postCopyBox');
  copyBox.value = post[currentPlatform] || '';

  // Update calculated UTM url
  const strategies = getStrategies();
  const strategy = strategies[post.campaign];
  const utmCampaign = strategy ? strategy.utm_label : post.campaign;
  const utmUrl = `https://smartoptimalsolutions.com/product.html?utm_campaign=${utmCampaign}&utm_source=${currentPlatform}&utm_medium=social_organic`;
  document.getElementById('utmLinkDisplay').innerText = utmUrl;
}

function approvePost() {
  const posts = getHubPosts();
  const post = posts.find(p => p.id === selectedPostId);
  if (post) {
    post.status = 'APPROVED';
    saveHubPosts(posts);
    loadPostPreview();
    renderCalendar();
    alert('✓ Post approved for queue scheduling!');
  }
}

function postponePost() {
  const posts = getHubPosts();
  const post = posts.find(p => p.id === selectedPostId);
  if (post) {
    post.status = 'PENDING';
    saveHubPosts(posts);
    loadPostPreview();
    renderCalendar();
    alert('Postponed. Status reset to Pending.');
  }
}

function deletePost() {
  if (confirm('Are you sure you want to delete this campaign post?')) {
    let posts = getHubPosts();
    posts = posts.filter(p => p.id !== selectedPostId);
    saveHubPosts(posts);
    selectedPostId = posts[0] ? posts[0].id : null;
    loadPostPreview();
    renderCalendar();
  }
}

function renderComments() {
  const posts = getHubPosts();
  const post = posts.find(p => p.id === selectedPostId);
  const container = document.getElementById('commentsContainer');
  container.innerHTML = '';
  
  if (!post || !post.comments || post.comments.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary); font-size:0.8rem; font-style:italic;">No team feedback yet.</p>';
    return;
  }

  post.comments.forEach(c => {
    const el = document.createElement('div');
    el.style.background = 'rgba(255,255,255,0.02)';
    el.style.border = '1px solid var(--border-color)';
    el.style.padding = '0.75rem';
    el.style.borderRadius = '8px';
    el.style.marginBottom = '0.5rem';
    el.style.fontSize = '0.8rem';
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-weight:600;">
        <span style="color:var(--accent-color);">${c.user}</span>
        <span style="color:var(--text-secondary); font-size:0.7rem;">${c.time}</span>
      </div>
      <p style="margin:0; color:var(--text-primary); line-height:1.4;">${c.text}</p>
    `;
    container.appendChild(el);
  });
}

function addComment() {
  const input = document.getElementById('commentInput');
  const text = input.value.trim();
  if (!text) return;

  const posts = getHubPosts();
  const post = posts.find(p => p.id === selectedPostId);
  if (post) {
    if (!post.comments) post.comments = [];
    post.comments.push({
      user: 'Growth Director (You)',
      time: 'Just now',
      text: text
    });
    saveHubPosts(posts);
    input.value = '';
    renderComments();
  }
}
