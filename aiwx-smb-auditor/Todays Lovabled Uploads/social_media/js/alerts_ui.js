// alerts_ui.js - Extracted inbox notification alerts logic

function loadActivityAlerts() {
      try {
        const res = await fetch(getApiUrl('/api/activity-alerts'));
        const data = await res.json();
        if (data.success) {
          const oldLength = activeAlertsList.filter(a => a.status === 'UNRESOLVED').length;
          activeAlertsList = data.alerts || [];
          renderAlertsInbox();
          
          const newUnresolved = activeAlertsList.filter(a => a.status === 'UNRESOLVED');
          if (newUnresolved.length > oldLength && oldLength > 0) {
            const latest = newUnresolved[0];
            playAlertSound();
            showToastAlert(latest.platform, latest.userName, latest.commentText);
          }
        }
      } catch (err) {
        console.warn('Failed to load activity alerts from server, falling back to localStorage:', err);
        let localAlerts = localStorage.getItem('aiwx_activity_alerts');
        if (!localAlerts) {
          const seedAlerts = [
            {
              id: "alert_01",
              platform: "linkedin",
              userName: "Sarah Jenkins",
              userHandle: "@sarah-j-growth",
              avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
              commentText: "This B2B upskilling model is exactly what we need. How do we book a scoping session?",
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: "UNRESOLVED",
              postTitle: "Auditing Your Problem Zero: Surgical process scoping",
              aiDraft: "Hello Sarah! Thanks for reaching out. We would love to map your workflows. You can schedule a Free Scoping Diagnostics call directly at https://convergence-ai.com/services."
            },
            {
              id: "alert_02",
              platform: "threads",
              userName: "David Chen",
              userHandle: "@dchen_tech",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
              commentText: "Is the automated calendar HIPAA compliant for clinical scheduling?",
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              status: "UNRESOLVED",
              postTitle: "Stop routing data by hand: Secure intake routing",
              aiDraft: "Hello David! Yes, our pipeline architecture uses isolated sandbox instances and standard encryption protocols, ensuring full HIPAA compliance for medical scheduling. Let us scope it out!"
            },
            {
              id: "alert_03",
              platform: "instagram",
              userName: "Marcus Brody",
              userHandle: "@marcus_advisors",
              avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
              commentText: "Will this work with private-cloud containerized instances?",
              timestamp: new Date(Date.now() - 10800000).toISOString(),
              status: "UNRESOLVED",
              postTitle: "Surgical process scoping: Reclaiming team capacity",
              aiDraft: "Hi Marcus! Yes, our custom connector builds are packaged as lightweight docker containers, making them easy to deploy on any private-cloud or on-premise infrastructure."
            }
          ];
          localStorage.setItem('aiwx_activity_alerts', JSON.stringify(seedAlerts));
          activeAlertsList = seedAlerts;
        } else {
          activeAlertsList = JSON.parse(localAlerts);
        }
        renderAlertsInbox();

        // Simulate background scanner offline
        if (false) { // Permanently disabled offline simulation
          const names = ["Alice Vance", "Robert Carter", "Elena Rostova", "Kofi Mensah"];
          const handles = ["@alicev", "@rcarter_ops", "@elena_rost", "@kofi_growth"];
          const platforms = ["linkedin", "threads", "instagram", "facebook"];
          const comments = [
            "What is the average onboarding setup time for a professional services firm?",
            "Can we connect our local QuickBooks server directly using this container?",
            "Are there any case studies for manufacturing workflows?",
            "Thanks for sharing. We saved 15 hours last week after automating invoice matchings."
          ];
          const posts = ["The Invisible Tax: Manual data syncing", "Visualizing capacity: The 24-hour setup", "Solution-First Automation: Upskilling your front desk"];
          
          const randIdx = Math.floor(Math.random() * names.length);
          const randPlat = platforms[Math.floor(Math.random() * platforms.length)];
          const randComm = comments[Math.floor(Math.random() * comments.length)];
          const randPost = posts[Math.floor(Math.random() * posts.length)];
          
          const newAlert = {
            id: "alert_offline_" + Date.now(),
            platform: randPlat,
            userName: names[randIdx],
            userHandle: handles[randIdx],
            avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random()*900000)}?w=150`,
            commentText: randComm,
            timestamp: new Date().toISOString(),
            status: "UNRESOLVED",
            postTitle: randPost,
            aiDraft: `Hello! Thanks for your question. Yes, we support custom integrations for ${randPost}. Let's chat!`
          };
          
          activeAlertsList.unshift(newAlert);
          localStorage.setItem('aiwx_activity_alerts', JSON.stringify(activeAlertsList));
          renderAlertsInbox();
          playAlertSound();
          showToastAlert(randPlat, names[randIdx], randComm);
        }
      }
    }

function renderAlertsInbox() {
      const container = document.getElementById('alertsInboxList');
      if (!container) return;
      container.innerHTML = '';

      const unresolvedAlerts = activeAlertsList.filter(a => a.status !== 'RESOLVED');

      if (unresolvedAlerts.length === 0) {
        container.innerHTML = `
          <div style="padding:3rem; text-align:center; color:var(--text-secondary); border:1px dashed var(--border-color); border-radius:8px; width:100%; box-sizing:border-box;">
            <div style="font-size:2rem; opacity:0.3; margin-bottom:0.5rem;">📬</div>
            <p style="font-size:0.85rem; font-weight:600; margin:0;">Inbox Empty</p>
            <p style="font-size:0.75rem; margin:0; margin-top:0.25rem;">No social activities detected. Alerts will appear here when comments or inquiries arrive.</p>
          </div>
        `;
        document.getElementById('replyConsole').style.display = 'none';
        document.getElementById('replyConsoleEmpty').style.display = 'flex';
        return;
      }

      unresolvedAlerts.forEach(alert => {
        const item = document.createElement('div');
        item.className = 'activity-feed-item' + (alert.id === selectedAlertId ? ' active-selection' : '');
        
        let platformIcon = '🔵';
        let platformColor = '#009ee6';
        if (alert.platform === 'threads') {
          platformIcon = 'T';
          platformColor = '#000000';
        } else if (alert.platform === 'instagram') {
          platformIcon = '📷';
          platformColor = '#e1306c';
        } else if (alert.platform === 'facebook') {
          platformIcon = '📘';
          platformColor = '#1877f2';
        }

        const isLead = alert.commentText.toLowerCase().includes('how') || 
                       alert.commentText.toLowerCase().includes('hipaa') || 
                       alert.commentText.toLowerCase().includes('price') || 
                       alert.commentText.toLowerCase().includes('cost') || 
                       alert.commentText.toLowerCase().includes('scoping') || 
                       alert.commentText.toLowerCase().includes('audit') || 
                       alert.commentText.toLowerCase().includes('integrate') || 
                       alert.commentText.toLowerCase().includes('support') || 
                       alert.commentText.toLowerCase().includes('started');
        
        const badgeMarkup = isLead && alert.status !== 'REPLIED'
          ? `<span class="action-badge" style="background:rgba(245,158,11,0.15); color:var(--warning-color); border:1px solid rgba(245,158,11,0.25); margin-left: auto;">⚠️ Lead Inquiry</span>`
          : alert.status === 'REPLIED'
            ? `<span class="action-badge" style="background:rgba(16,185,129,0.15); color:var(--success-color); border:1px solid rgba(16,185,129,0.25); margin-left: auto;">✓ Replied</span>`
            : `<span class="action-badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary); margin-left: auto;">Activity</span>`;

        item.innerHTML = `
          <div class="feed-avatar" style="background-image:url('${alert.avatar}'); background-size:cover; background-position:center; width:40px; height:40px; border-radius:50%; border:1px solid var(--border-color); flex-shrink:0;"></div>
          <div style="flex-grow:1; display:flex; flex-direction:column; gap:0.25rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-weight:600; font-size:0.85rem; color:var(--text-primary);">${alert.userName}</span>
              <span style="font-size:0.7rem; color:var(--text-secondary);">${alert.userHandle}</span>
            </div>
            <p style="font-size:0.8rem; color:var(--text-primary); line-height:1.4; margin:0;">"${alert.commentText}"</p>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.4rem; font-size:0.7rem; color:var(--text-secondary);">
              <span style="background:${platformColor}; color:#fff; border-radius:4px; padding:0.1rem 0.3rem; font-weight:700; font-size:0.6rem;">${alert.platform.toUpperCase()}</span>
              <span>•</span>
              <span>${new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
          ${badgeMarkup}
        `;
        
        item.onclick = () => selectCommentAlert(alert.id);
        container.appendChild(item);
      });
    }

function selectCommentAlert(id) {
      selectedAlertId = id;
      renderAlertsInbox();
      
      const alert = activeAlertsList.find(a => a.id === id);
      if (!alert) return;

      document.getElementById('replyConsoleEmpty').style.display = 'none';
      const consoleCard = document.getElementById('replyConsole');
      consoleCard.style.display = 'block';

      document.getElementById('replyConsoleTitle').innerText = `💬 Scoped ${alert.platform.toUpperCase()} Reply`;
      
      const pBadge = document.getElementById('replyPlatformBadge');
      pBadge.innerText = alert.platform.toUpperCase();
      pBadge.style.background = alert.platform === 'threads' ? '#000' : alert.platform === 'instagram' ? '#e1306c' : '#009ee6';

      document.getElementById('replyContextUser').innerText = alert.userName;
      document.getElementById('replyContextComment').innerText = `"${alert.commentText}"`;
      document.getElementById('replyContextPost').innerText = alert.postTitle;
      
      const editor = document.getElementById('replyTextEditor');
      editor.value = alert.replyText || alert.aiDraft || '';
    }

function regenerateAIDraft() {
      if (!selectedAlertId) return;
      try {
        const res = await fetch(getApiUrl('/api/generate-reply'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentId: selectedAlertId })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('replyTextEditor').value = data.replyDraft;
          const alert = activeAlertsList.find(a => a.id === selectedAlertId);
          if (alert) alert.aiDraft = data.replyDraft;
        }
      } catch (err) {
        console.warn('Failed to regenerate AI draft on server, generating local mockup response:', err);
        const alertObj = activeAlertsList.find(a => a.id === selectedAlertId);
        if (alertObj) {
          const mockDrafts = [
            "Hi! Thanks for your inquiry. Yes, we support custom integrations for this workflow. Let's schedule a scoping session at convergence-ai.com.",
            "Hello! We focus on upskilling your existing staff rather than cutting headcount. Let's arrange a diagnostics call.",
            "Thanks for reaching out! Our Private-Cloud connectors are fully compliant and isolated. Let's scope it out."
          ];
          const chosen = mockDrafts[Math.floor(Math.random() * mockDrafts.length)];
          document.getElementById('replyTextEditor').value = chosen;
          alertObj.aiDraft = chosen;
          localStorage.setItem('aiwx_activity_alerts', JSON.stringify(activeAlertsList));
        }
      }
    }

function submitHITLReply() {
      if (!selectedAlertId) return;
      const text = document.getElementById('replyTextEditor').value.trim();
      if (!text) {
        alert('Please draft a reply first.');
        return;
      }

      try {
        const res = await fetch(getApiUrl('/api/post-reply'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentId: selectedAlertId, replyText: text })
        });
        const data = await res.json();
        if (data.success) {
          alert('✓ Response approved & mock-posted back to channel!');
          const alert = activeAlertsList.find(a => a.id === selectedAlertId);
          if (alert) {
            alert.status = 'REPLIED';
            alert.replyText = text;
          }
          selectedAlertId = null;
          loadActivityAlerts();
        }
      } catch (err) {
        console.warn('Failed to submit reply to server, executing client-side simulation:', err);
        const alertObj = activeAlertsList.find(a => a.id === selectedAlertId);
        if (alertObj) {
          alertObj.status = 'REPLIED';
          alertObj.replyText = text;
          localStorage.setItem('aiwx_activity_alerts', JSON.stringify(activeAlertsList));
          alert('✓ [Offline Mode] Response approved & mock-posted back to channel!');
          selectedAlertId = null;
          renderAlertsInbox();
        }
      }
    }

function dismissAlert() {
      if (!selectedAlertId) return;
      try {
        const res = await fetch(getApiUrl('/api/activity-alerts/resolve'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedAlertId })
        });
        const data = await res.json();
        if (data.success) {
          const alert = activeAlertsList.find(a => a.id === selectedAlertId);
          if (alert) alert.status = 'RESOLVED';
          selectedAlertId = null;
          loadActivityAlerts();
        }
      } catch (err) {
        console.warn('Failed to dismiss alert on server, executing client-side simulation:', err);
        const alertObj = activeAlertsList.find(a => a.id === selectedAlertId);
        if (alertObj) {
          alertObj.status = 'RESOLVED';
          localStorage.setItem('aiwx_activity_alerts', JSON.stringify(activeAlertsList));
          selectedAlertId = null;
          renderAlertsInbox();
        }
      }
    }

function updateScanFrequency(ms) {
      clearInterval(scannerLoopInterval);
      scannerLoopInterval = setInterval(loadActivityAlerts, parseInt(ms, 10));
      console.log(`[Scanner] Interval updated to ${ms}ms`);
    }

function playAlertSound() {
      if (!document.getElementById('optSoundAlerts').checked) return;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, start, duration) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gainNode.gain.setValueAtTime(0.12, start);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        const now = audioCtx.currentTime;
        playTone(523.25, now, 0.15); // C5
        playTone(659.25, now + 0.1, 0.3); // E5
      } catch (e) {
        console.warn('Web Audio chime blocked by browser autoplay policy.');
      }
    }

function showToastAlert(platform, userName, text) {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
      }
      
      const toast = document.createElement('div');
      toast.className = 'toast-notification';
      
      let color = '#009ee6';
      if (platform === 'threads') color = '#fff';
      else if (platform === 'instagram') color = '#e1306c';
      
      toast.innerHTML = `
        <div style="background:${color}; color:#fff; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:bold; flex-shrink:0;">⚡</div>
        <div style="font-size:0.8rem;">
          <p style="font-weight:700; margin:0; color:var(--text-primary);">New Inbound on ${platform.toUpperCase()}</p>
          <p style="margin:0.15rem 0 0 0; color:var(--text-secondary); max-width:250px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; font-size:0.75rem;">
            <strong>${userName}</strong>: "${text}"
          </p>
        </div>
      `;
      
      container.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 100);
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
      }, 5000);
    }

