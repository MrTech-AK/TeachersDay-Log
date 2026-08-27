document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const navReceive = document.getElementById('navReceive');
    const navActivity = document.getElementById('navActivity');
    const viewReceive = document.getElementById('viewReceive');
    const viewActivity = document.getElementById('viewActivity');
    
    const contributorSelect = document.getElementById('contributor');
    const paymentRadios = document.getElementsByName('payment_method');
    const upiRefGroup = document.getElementById('upiRefGroup');
    const upiRefInput = document.getElementById('upi_reference');
    
    const contributionForm = document.getElementById('contributionForm');
    const submitBtn = document.getElementById('submitBtn');
    const formFeedback = document.getElementById('formFeedback');
    
    const refreshActivityBtn = document.getElementById('refreshActivityBtn');
    const activityList = document.getElementById('activityList');

    // 1. Session Check
    try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();
        if (!authData.authenticated) {
            window.location.href = '/';
            return;
        }
        usernameDisplay.textContent = authData.user.username;
    } catch (e) {
        console.error('Session check failed', e);
        window.location.href = '/';
    }

    // 2. Load Contributors
    async function loadContributors() {
        try {
            const res = await fetch('/api/contributors');
            const contributors = await res.json();
            
            contributors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = \`\${c.class_section} - \${c.name}\`;
                contributorSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to load contributors', e);
            showFeedback('error', 'Failed to load contributors. Please refresh.');
        }
    }
    loadContributors();

    // 3. Navigation
    function switchView(view) {
        navReceive.classList.remove('active');
        navActivity.classList.remove('active');
        viewReceive.classList.remove('active');
        viewActivity.classList.remove('active');
        formFeedback.className = 'feedback-msg';

        if (view === 'receive') {
            navReceive.classList.add('active');
            viewReceive.classList.add('active');
        } else if (view === 'activity') {
            navActivity.classList.add('active');
            viewActivity.classList.add('active');
            loadActivity();
        }
    }

    navReceive.addEventListener('click', () => switchView('receive'));
    navActivity.addEventListener('click', () => switchView('activity'));

    // 4. Form Logic
    // Toggle UPI input
    Array.from(paymentRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'UPI') {
                upiRefGroup.style.display = 'block';
                upiRefInput.required = true;
            } else {
                upiRefGroup.style.display = 'none';
                upiRefInput.required = false;
                upiRefInput.value = '';
            }
        });
    });

    function showFeedback(type, message) {
        formFeedback.textContent = message;
        formFeedback.className = \`feedback-msg \${type}\`;
        if (type === 'success') {
            setTimeout(() => {
                formFeedback.className = 'feedback-msg';
            }, 5000);
        }
    }

    contributionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'RECORDING...';
        formFeedback.className = 'feedback-msg';

        const payload = {
            contributor_id: document.getElementById('contributor').value,
            amount: document.getElementById('amount').value,
            payment_method: document.querySelector('input[name="payment_method"]:checked').value,
            upi_reference: document.getElementById('upi_reference').value || null,
            note: document.getElementById('note').value || null
        };

        try {
            const res = await fetch('/api/contributions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) {
                showFeedback('error', data.error || 'Failed to record contribution');
            } else {
                showFeedback('success', \`Success! Transaction ID: \${data.contribution.transaction_code}\`);
                contributionForm.reset();
                // Reset UPI field visibility
                upiRefGroup.style.display = 'block';
                upiRefInput.required = true;
            }
        } catch (err) {
            console.error(err);
            showFeedback('error', 'Network error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'RECORD CONTRIBUTION';
        }
    });

    // 5. Activity Loading
    async function loadActivity() {
        activityList.innerHTML = '<div class="loading">Loading...</div>';
        try {
            const res = await fetch('/api/contributions/my-activity');
            const activities = await res.json();

            if (!res.ok) throw new Error(activities.error || 'Failed to load');

            if (activities.length === 0) {
                activityList.innerHTML = '<div>No contributions recorded yet.</div>';
                return;
            }

            activityList.innerHTML = activities.map(act => {
                const date = new Date(act.created_at).toLocaleString();
                let refText = act.payment_method === 'UPI' ? \` • Ref: \${act.upi_reference}\` : '';
                let noteHtml = act.note ? \`<div class="ac-note">\${act.note}</div>\` : '';
                return \`
                    <div class="activity-card">
                        <div class="activity-card-header">
                            <span class="ac-id">\${act.transaction_code}</span>
                            <span class="ac-amount">₹\${Number(act.amount).toFixed(2)}</span>
                        </div>
                        <div class="ac-name">\${act.contributor_name} (\${act.class_section})</div>
                        <div class="ac-details">
                            \${date} • \${act.payment_method}\${refText}
                        </div>
                        \${noteHtml}
                    </div>
                \`;
            }).join('');
        } catch (err) {
            console.error(err);
            activityList.innerHTML = \`<div class="error-msg">Failed to load activity.</div>\`;
        }
    }

    refreshActivityBtn.addEventListener('click', loadActivity);

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (e) {
            console.error('Logout failed', e);
        }
    });
});
