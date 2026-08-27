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
                opt.textContent = `${c.class}-${c.section} - ${c.name}`;
                contributorSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to load contributors', e);
            showFeedback('error', 'Failed to load contributors. Please refresh.');
        }
    }
    loadContributors();

    // 3. Navigation
    const navExpense = document.getElementById('navExpense');
    const viewExpense = document.getElementById('viewExpense');

    function switchView(view) {
        navReceive.classList.remove('active');
        navActivity.classList.remove('active');
        navExpense.classList.remove('active');
        viewReceive.classList.remove('active');
        viewActivity.classList.remove('active');
        viewExpense.classList.remove('active');
        formFeedback.className = 'feedback-msg';

        if (view === 'receive') {
            navReceive.classList.add('active');
            viewReceive.classList.add('active');
        } else if (view === 'expense') {
            navExpense.classList.add('active');
            viewExpense.classList.add('active');
        } else if (view === 'activity') {
            navActivity.classList.add('active');
            viewActivity.classList.add('active');
            loadActivity();
        }
    }

    navReceive.addEventListener('click', () => switchView('receive'));
    navExpense.addEventListener('click', () => switchView('expense'));
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
        formFeedback.className = `feedback-msg ${type}`;
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
                showFeedback('success', `Success! Transaction ID: ${data.contribution.transaction_code}`);
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

    // 4b. Expense Form Logic
    const expenseForm = document.getElementById('expenseForm');
    const expSubmitBtn = document.getElementById('expSubmitBtn');
    const expFormFeedback = document.getElementById('expFormFeedback');

    function showExpFeedback(type, message) {
        expFormFeedback.textContent = message;
        expFormFeedback.className = `feedback-msg ${type}`;
        if (type === 'success') {
            setTimeout(() => {
                expFormFeedback.className = 'feedback-msg';
            }, 5000);
        }
    }

    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        expSubmitBtn.disabled = true;
        expSubmitBtn.textContent = 'SUBMITTING...';
        expFormFeedback.className = 'feedback-msg';

        const formData = new FormData(expenseForm);

        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                body: formData // FormData automatically sets multipart/form-data headers
            });
            const data = await res.json();

            if (!res.ok) {
                showExpFeedback('error', data.error || 'Failed to submit expense');
            } else {
                showExpFeedback('success', `Success! Expense ID: ${data.expense.expense_code}`);
                expenseForm.reset();
            }
        } catch (err) {
            console.error(err);
            showExpFeedback('error', 'Network error. Please try again.');
        } finally {
            expSubmitBtn.disabled = false;
            expSubmitBtn.textContent = 'SUBMIT EXPENSE';
        }
    });

    // 5. Activity Loading
    async function loadActivity() {
        activityList.innerHTML = '<div class="loading">Loading...</div>';
        try {
            const [contribRes, expRes] = await Promise.all([
                fetch('/api/contributions/my-activity'),
                fetch('/api/expenses/my-activity')
            ]);
            
            const contributions = await contribRes.json();
            const expenses = await expRes.json();

            if (!contribRes.ok) throw new Error(contributions.error || 'Failed to load contributions');
            if (!expRes.ok) throw new Error(expenses.error || 'Failed to load expenses');

            // Combine and sort by date descending
            const activities = [
                ...contributions.map(c => ({ ...c, type: 'contribution' })),
                ...expenses.map(e => ({ ...e, type: 'expense' }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (activities.length === 0) {
                activityList.innerHTML = '<div>No activity recorded yet.</div>';
                return;
            }

            activityList.innerHTML = activities.map(act => {
                const date = new Date(act.created_at).toLocaleString();
                
                if (act.type === 'contribution') {
                    let refText = act.payment_method === 'UPI' ? ` • Ref: ${act.upi_reference}` : '';
                    let noteHtml = act.note ? `<div class="ac-note">${act.note}</div>` : '';
                    return `
                        <div class="activity-card">
                            <div class="activity-card-header">
                                <span class="ac-id">${act.transaction_code}</span>
                                <span class="ac-amount" style="color: #16a34a">+ ₹${Number(act.amount).toFixed(2)}</span>
                            </div>
                            <div class="ac-name">${act.contributor_name} (${act.class}-${act.section})</div>
                            <div class="ac-details">
                                ${date} • ${act.payment_method}${refText}
                            </div>
                            ${noteHtml}
                        </div>
                    `;
                } else {
                    let statusColor = act.status === 'verified' ? '#16a34a' : act.status === 'rejected' ? '#dc2626' : '#d97706';
                    let receiptLink = act.receipt_path ? ` • <a href="/api/expenses/receipt/${act.receipt_path}" target="_blank">View Receipt</a>` : '';
                    let notes = act.verification_notes ? `<div class="ac-note" style="color:#b91c1c">Note: ${act.verification_notes}</div>` : '';
                    return `
                        <div class="activity-card">
                            <div class="activity-card-header">
                                <span class="ac-id">${act.expense_code}</span>
                                <span class="ac-amount" style="color: #dc2626">- ₹${Number(act.amount).toFixed(2)}</span>
                            </div>
                            <div class="ac-name">${act.category}: ${act.description} (Paid by ${act.paid_by})</div>
                            <div class="ac-details">
                                ${date} • <span style="font-weight:bold;color:${statusColor}">${act.status.toUpperCase()}</span>${receiptLink}
                            </div>
                            ${notes}
                        </div>
                    `;
                }
            }).join('');
        } catch (err) {
            console.error(err);
            activityList.innerHTML = `<div class="error-msg">Failed to load activity.</div>`;
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
