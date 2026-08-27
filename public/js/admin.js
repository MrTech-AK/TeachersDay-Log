document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();
        if (!authData.authenticated || authData.user.role !== 'admin') {
            window.location.href = '/';
            return;
        }
        document.getElementById('usernameDisplay').textContent = authData.user.username;
    } catch (e) {
        window.location.href = '/';
    }

    // Navigation
    const views = {
        dashboard: document.getElementById('viewDashboard'),
        contributors: document.getElementById('viewContributors'),
        contributions: document.getElementById('viewContributions'),
        expenses: document.getElementById('viewExpenses'),
        reconciliation: document.getElementById('viewReconciliation'),
        reports: document.getElementById('viewReports'),
        audit: document.getElementById('viewAudit')
    };
    const navs = {
        dashboard: document.getElementById('navDashboard'),
        contributors: document.getElementById('navContributors'),
        contributions: document.getElementById('navContributions'),
        expenses: document.getElementById('navExpenses'),
        reconciliation: document.getElementById('navReconciliation'),
        reports: document.getElementById('navReports'),
        audit: document.getElementById('navAudit')
    };

    function switchView(viewName) {
        Object.values(views).forEach(v => {
            if(v) v.classList.remove('active');
        });
        Object.values(navs).forEach(n => {
            if(n) n.classList.remove('active');
        });
        
        if (views[viewName]) views[viewName].classList.add('active');
        if (navs[viewName]) navs[viewName].classList.add('active');

        if (viewName === 'dashboard') loadDashboard();
        if (viewName === 'contributors') loadContributors();
        if (viewName === 'contributions') loadContributions();
        if (viewName === 'expenses') loadExpenses();
        if (viewName === 'reconciliation') loadReconciliations();
        if (viewName === 'reports') loadReports();
        if (viewName === 'audit') loadAuditLogs();
    }

    Object.keys(navs).forEach(key => {
        if (navs[key]) {
            navs[key].addEventListener('click', () => switchView(key));
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    });

    // Formatting utilities
    const formatMoney = (amount) => `₹${Number(amount).toFixed(2)}`;
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString();

    // 1. DASHBOARD OVERVIEW
    async function loadDashboard() {
        try {
            const statsRes = await fetch('/api/admin/stats');
            const stats = await statsRes.json();
            
            document.getElementById('statExpected').textContent = formatMoney(stats.totalExpected);
            document.getElementById('statCollected').textContent = formatMoney(stats.totalCollected);
            document.getElementById('statPending').textContent = formatMoney(stats.totalPending);
            document.getElementById('statExpenses').textContent = formatMoney(stats.totalVerifiedExpenses);
            document.getElementById('statBalance').textContent = formatMoney(stats.expectedBalance);
            document.getElementById('statPendingExp').textContent = formatMoney(stats.totalPendingExpenses);
            document.getElementById('statRejectedExp').textContent = formatMoney(stats.totalRejectedExpenses);

            const collRes = await fetch('/api/admin/collectors');
            const collectors = await collRes.json();
            
            const collContainer = document.getElementById('collectorSummaryList');
            collContainer.innerHTML = collectors.map(c => `
                <div class="collector-card">
                    <div class="collector-card-header">${c.full_name} (${c.username})</div>
                    <div class="collector-stat">
                        <span>Transactions:</span>
                        <span>${c.transaction_count}</span>
                    </div>
                    <div class="collector-stat">
                        <span>UPI:</span>
                        <span>${formatMoney(c.upi_total)}</span>
                    </div>
                    <div class="collector-stat">
                        <span>Cash:</span>
                        <span>${formatMoney(c.cash_total)}</span>
                    </div>
                    <div class="collector-stat total">
                        <span>Total Collected:</span>
                        <span>${formatMoney(c.total_collected)}</span>
                    </div>
                    <div class="collector-stat" style="color: #dc2626">
                        <span>Expenses Logged:</span>
                        <span>${formatMoney(c.total_verified_expenses)}</span>
                    </div>
                    <div class="collector-stat total" style="background: #eef2ff; border-top: 1px solid #c7d2fe; padding-top: 0.5rem; margin-top: 0.5rem;">
                        <span>Ledger Balance:</span>
                        <span>${formatMoney(c.ledger_balance)}</span>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error(err);
        }
    }

    // 2. CONTRIBUTORS
    const contribModal = document.getElementById('contributorModal');
    const contribForm = document.getElementById('contributorForm');
    let allContributors = [];

    async function loadContributors() {
        try {
            const res = await fetch('/api/admin/contributors');
            allContributors = await res.json();
            renderContributors();
        } catch (err) {
            console.error(err);
        }
    }

    function renderContributors() {
        const tbody = document.getElementById('contributorsTableBody');
        if (!allContributors.length) {
            tbody.innerHTML = '<tr><td colspan="7">No contributors found.</td></tr>';
            return;
        }

        tbody.innerHTML = allContributors.map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.class}</td>
                <td>${c.section}</td>
                <td>${formatMoney(c.expected_amount)}</td>
                <td>${formatMoney(c.total_paid)}</td>
                <td><span class="status-badge status-${c.status}">${c.status}</span></td>
                <td>
                    <button class="btn-text edit-contrib-btn" data-id="${c.id}">Edit</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.edit-contrib-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const contrib = allContributors.find(x => x.id === id);
                openContributorModal(contrib);
            });
        });
    }

    document.getElementById('addContributorBtn').addEventListener('click', () => openContributorModal());
    document.getElementById('closeModalBtn').addEventListener('click', () => contribModal.classList.remove('active'));

    function openContributorModal(contrib = null) {
        document.getElementById('modalError').textContent = '';
        if (contrib) {
            document.getElementById('modalTitle').textContent = 'Edit Contributor';
            document.getElementById('contribId').value = contrib.id;
            document.getElementById('contribName').value = contrib.name;
            document.getElementById('contribClass').value = contrib.class;
            document.getElementById('contribSection').value = contrib.section;
            document.getElementById('contribExpected').value = contrib.expected_amount;
            document.getElementById('contribActive').checked = contrib.is_active;
        } else {
            document.getElementById('modalTitle').textContent = 'Add Contributor';
            contribForm.reset();
            document.getElementById('contribId').value = '';
        }
        contribModal.classList.add('active');
    }

    contribForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('contribId').value;
        const payload = {
            name: document.getElementById('contribName').value,
            class: document.getElementById('contribClass').value,
            section: document.getElementById('contribSection').value,
            expected_amount: document.getElementById('contribExpected').value,
            is_active: document.getElementById('contribActive').checked
        };

        try {
            const url = id ? `/api/admin/contributors/${id}` : '/api/admin/contributors';
            const method = id ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                document.getElementById('modalError').textContent = data.error || 'Failed to save';
                return;
            }

            contribModal.classList.remove('active');
            loadContributors();
            loadDashboard(); // Refresh stats
        } catch (err) {
            console.error(err);
            document.getElementById('modalError').textContent = 'Network error';
        }
    });

    // 3. CONTRIBUTIONS
    let allContributions = [];
    
    async function loadContributions() {
        try {
            const res = await fetch('/api/admin/contributions');
            allContributions = await res.json();
            
            // Populate collector filter dynamically
            const collectors = [...new Set(allContributions.map(c => c.collector_name))];
            const filterCollector = document.getElementById('filterCollector');
            filterCollector.innerHTML = '<option value="">All Collectors</option>' + 
                collectors.map(c => `<option value="${c}">${c}</option>`).join('');

            renderContributions();
        } catch (err) {
            console.error(err);
        }
    }

    function renderContributions() {
        const txFilter = document.getElementById('filterTx').value.toLowerCase();
        const nameFilter = document.getElementById('filterName').value.toLowerCase();
        const collectorFilter = document.getElementById('filterCollector').value;
        const methodFilter = document.getElementById('filterMethod').value;

        const filtered = allContributions.filter(c => {
            if (txFilter && !c.transaction_code.toLowerCase().includes(txFilter)) return false;
            if (nameFilter && !c.contributor_name.toLowerCase().includes(nameFilter)) return false;
            if (collectorFilter && c.collector_name !== collectorFilter) return false;
            if (methodFilter && c.payment_method !== methodFilter) return false;
            return true;
        });

        const tbody = document.getElementById('contributionsTableBody');
        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6">No contributions match filters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(c => `
            <tr>
                <td><strong>${c.transaction_code}</strong></td>
                <td>${formatDate(c.created_at)}</td>
                <td>${c.contributor_name} (${c.class}-${c.section})</td>
                <td>${formatMoney(c.amount)}</td>
                <td>${c.payment_method} ${c.payment_method === 'UPI' ? `<br><small>${c.upi_reference}</small>` : ''}</td>
                <td>${c.collector_name}</td>
            </tr>
        `).join('');
    }

    // Attach filter events
    document.getElementById('filterTx').addEventListener('input', renderContributions);
    document.getElementById('filterName').addEventListener('input', renderContributions);
    document.getElementById('filterCollector').addEventListener('change', renderContributions);
    document.getElementById('filterMethod').addEventListener('change', renderContributions);

    // Refresh Buttons
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            if (target === 'dashboard') loadDashboard();
            if (target === 'contributors') loadContributors();
            if (target === 'contributions') loadContributions();
            if (target === 'expenses') loadExpenses();
            if (target === 'audit') loadAuditLogs();
        });
    });

    // 4. EXPENSES
    let allExpenses = [];
    async function loadExpenses() {
        try {
            const res = await fetch('/api/admin/expenses');
            allExpenses = await res.json();
            renderExpenses();
        } catch (err) {
            console.error(err);
        }
    }

    function renderExpenses() {
        const statusFilter = document.getElementById('filterExpStatus').value;
        const filtered = statusFilter ? allExpenses.filter(e => e.status === statusFilter) : allExpenses;

        const tbody = document.getElementById('expensesTableBody');
        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7">No expenses match filters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(e => `
            <tr>
                <td><strong>${e.expense_code}</strong></td>
                <td>
                    ${formatDate(e.created_at)}<br>
                    <small>By: ${e.created_by_name}</small>
                </td>
                <td>
                    <strong>${e.category}</strong><br>
                    <small>${e.description} (Paid by ${e.paid_by})</small>
                </td>
                <td>${formatMoney(e.amount)}</td>
                <td>
                    <span class="status-badge status-${e.status}">${e.status.toUpperCase()}</span>
                    ${e.verification_notes ? `<br><small style="color:red">${e.verification_notes}</small>` : ''}
                </td>
                <td>
                    ${e.receipt_path ? `<a href="/api/expenses/receipt/${e.receipt_path}" target="_blank">View</a>` : 'None'}
                </td>
                <td>
                    ${e.status === 'pending' ? `
                        <button class="btn-primary exp-review-btn" data-id="${e.id}">Review</button>
                    ` : `
                        <small>By: ${e.verified_by_name}</small>
                    `}
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.exp-review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                openExpenseModal(id);
            });
        });
    }

    document.getElementById('filterExpStatus').addEventListener('change', renderExpenses);

    const expModal = document.getElementById('expenseModal');
    const expReviewForm = document.getElementById('expenseReviewForm');
    
    function openExpenseModal(id) {
        document.getElementById('reviewExpId').value = id;
        document.getElementById('reviewAction').value = 'verified';
        document.getElementById('reviewNotes').value = '';
        document.getElementById('expModalError').textContent = '';
        expModal.classList.add('active');
    }

    document.getElementById('closeExpModalBtn').addEventListener('click', () => {
        expModal.classList.remove('active');
    });

    expReviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reviewExpId').value;
        const status = document.getElementById('reviewAction').value;
        const notes = document.getElementById('reviewNotes').value;

        if (status === 'rejected' && !notes.trim()) {
            document.getElementById('expModalError').textContent = 'Notes are required when rejecting.';
            return;
        }

        try {
            const res = await fetch(`/api/admin/expenses/${id}/verify`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, verification_notes: notes })
            });

            if (res.ok) {
                expModal.classList.remove('active');
                loadExpenses();
                loadDashboard();
            } else {
                const data = await res.json();
                document.getElementById('expModalError').textContent = data.error || 'Failed to update expense';
            }
        } catch (err) {
            console.error(err);
            document.getElementById('expModalError').textContent = 'Network error';
        }
    });

    // 5. RECONCILIATION
    async function loadReconciliations() {
        try {
            const res = await fetch('/api/admin/reconciliations');
            const data = await res.json();
            const tbody = document.getElementById('reconciliationTableBody');
            
            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="7">No reconciliations found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(r => {
                const diff = parseFloat(r.discrepancy);
                const isDiscrepancy = diff !== 0;
                const statusHtml = isDiscrepancy 
                    ? `<span style="color:#dc2626;font-weight:bold">DISCREPANCY</span>` 
                    : `<span style="color:#16a34a;font-weight:bold">RECONCILED</span>`;
                
                return `
                    <tr>
                        <td>${formatDate(r.created_at)}</td>
                        <td>${r.performed_by_name}</td>
                        <td>${formatMoney(r.expected_amount)}</td>
                        <td>${formatMoney(r.actual_amount)}</td>
                        <td style="color:${isDiscrepancy ? '#dc2626' : '#16a34a'}">${formatMoney(r.discrepancy)}</td>
                        <td>${statusHtml}</td>
                        <td>${r.notes || ''}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error(err);
        }
    }

    const reconModal = document.getElementById('reconciliationModal');
    const reconForm = document.getElementById('reconciliationForm');
    
    document.getElementById('newReconBtn').addEventListener('click', () => {
        reconForm.reset();
        document.getElementById('reconModalError').textContent = '';
        reconModal.classList.add('active');
    });

    document.getElementById('closeReconModalBtn').addEventListener('click', () => {
        reconModal.classList.remove('active');
    });

    reconForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const actual_amount = document.getElementById('reconActual').value;
        const notes = document.getElementById('reconNotes').value;

        try {
            const res = await fetch('/api/admin/reconciliations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actual_amount, notes })
            });

            if (res.ok) {
                reconModal.classList.remove('active');
                loadReconciliations();
                loadAuditLogs();
            } else {
                const data = await res.json();
                document.getElementById('reconModalError').textContent = data.error || 'Failed to save';
            }
        } catch (err) {
            console.error(err);
            document.getElementById('reconModalError').textContent = 'Network error';
        }
    });

    // 6. AUDIT LOGS
    let allAuditLogs = [];
    async function loadAuditLogs() {
        try {
            const res = await fetch('/api/admin/audit-logs');
            allAuditLogs = await res.json();
            renderAuditLogs();
        } catch (err) {
            console.error(err);
        }
    }

    function renderAuditLogs() {
        const actorFilter = document.getElementById('filterAuditActor').value.toLowerCase();
        const actionFilter = document.getElementById('filterAuditAction').value;
        const entityFilter = document.getElementById('filterAuditEntity').value;

        const filtered = allAuditLogs.filter(l => {
            const actorName = (l.actor_name || 'System').toLowerCase();
            if (actorFilter && !actorName.includes(actorFilter)) return false;
            if (actionFilter && l.action !== actionFilter) return false;
            if (entityFilter && l.entity_type !== entityFilter) return false;
            return true;
        });

        const tbody = document.getElementById('auditTableBody');

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6">No audit logs match filters.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(l => {
            let metadata = '';
            if (l.new_values) {
                try {
                    const parsed = typeof l.new_values === 'string' ? JSON.parse(l.new_values) : l.new_values;
                    metadata = Object.entries(parsed).map(([k,v]) => `<strong>${k}</strong>: ${v}`).join('<br>');
                } catch (e) {
                    metadata = l.new_values;
                }
            }
            
            return `
                <tr>
                    <td>${formatDate(l.created_at)}</td>
                    <td>${l.actor_name || 'System'}</td>
                    <td><span style="background:#eef2ff;padding:2px 6px;border-radius:4px;font-size:0.875rem;">${l.action.toUpperCase()}</span></td>
                    <td>${l.entity_type}</td>
                    <td><small>${l.entity_id || '-'}</small></td>
                    <td><small>${metadata}</small></td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('filterAuditActor').addEventListener('input', renderAuditLogs);
    document.getElementById('filterAuditAction').addEventListener('change', renderAuditLogs);
    document.getElementById('filterAuditEntity').addEventListener('change', renderAuditLogs);

    // 7. REPORTS
    async function loadReports() {
        const container = document.getElementById('reportContent');
        container.innerHTML = '<p class="loading">Loading report data...</p>';
        
        try {
            const res = await fetch('/api/admin/reports');
            if (!res.ok) throw new Error('Failed to load reports');
            const data = await res.json();
            
            let html = `
                <div class="report-section">
                    <h3>Summary</h3>
                    <table class="data-table">
                        <tr><td><strong>Total Expected</strong></td><td>${formatMoney(data.summary.totalExpected)}</td></tr>
                        <tr><td><strong>Total Collected</strong></td><td>${formatMoney(data.summary.totalCollected)}</td></tr>
                        <tr><td><strong>Total Pending Collections</strong></td><td>${formatMoney(data.summary.totalPending)}</td></tr>
                        <tr><td><strong>Total Verified Expenses</strong></td><td style="color:#dc2626">${formatMoney(data.summary.totalVerifiedExpenses)}</td></tr>
                        <tr><td><strong>Total Pending Expenses</strong></td><td>${formatMoney(data.summary.totalPendingExpenses)}</td></tr>
                        <tr><td><strong>Total Rejected Expenses</strong></td><td>${formatMoney(data.summary.totalRejectedExpenses)}</td></tr>
                        <tr style="background:#f0fdf4"><td><strong>Expected Remaining Balance</strong></td><td><strong>${formatMoney(data.summary.expectedBalance)}</strong></td></tr>
                    </table>
                </div>

                <div class="report-section" style="display: flex; gap: 2rem; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h3>Contributions by Class</h3>
                        <table class="data-table">
                            <thead><tr><th>Class</th><th>Total</th></tr></thead>
                            <tbody>
                                ${data.contributions.byClass.map(r => `<tr><td>${r.class}</td><td>${formatMoney(r.total)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="flex: 1; min-width: 300px;">
                        <h3>Contributions by Method</h3>
                        <table class="data-table">
                            <thead><tr><th>Method</th><th>Total</th></tr></thead>
                            <tbody>
                                ${data.contributions.byMethod.map(r => `<tr><td>${r.payment_method}</td><td>${formatMoney(r.total)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Contributions by Collector</h3>
                    <table class="data-table">
                        <thead><tr><th>Collector</th><th>Total</th></tr></thead>
                        <tbody>
                            ${data.contributions.byCollector.map(r => `<tr><td>${r.collector}</td><td>${formatMoney(r.total)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="report-section" style="display: flex; gap: 2rem; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h3>Verified Expenses by Category</h3>
                        <table class="data-table">
                            <thead><tr><th>Category</th><th>Total</th></tr></thead>
                            <tbody>
                                ${data.expenses.byCategory.length ? data.expenses.byCategory.map(r => `<tr><td>${r.category}</td><td>${formatMoney(r.total)}</td></tr>`).join('') : '<tr><td colspan="2">No verified expenses</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <div style="flex: 1; min-width: 300px;">
                        <h3>Verified Expenses by Payer</h3>
                        <table class="data-table">
                            <thead><tr><th>Payer</th><th>Total</th></tr></thead>
                            <tbody>
                                ${data.expenses.byPayer.length ? data.expenses.byPayer.map(r => `<tr><td>${r.paid_by}</td><td>${formatMoney(r.total)}</td></tr>`).join('') : '<tr><td colspan="2">No verified expenses</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Latest Reconciliation Checkpoint</h3>
                    ${data.reconciliation ? `
                        <table class="data-table">
                            <tr><td><strong>Date</strong></td><td>${formatDate(data.reconciliation.created_at)}</td></tr>
                            <tr><td><strong>Performed By</strong></td><td>${data.reconciliation.performed_by_name}</td></tr>
                            <tr><td><strong>Expected Balance</strong></td><td>${formatMoney(data.reconciliation.expected_amount)}</td></tr>
                            <tr><td><strong>Reported Actual Balance</strong></td><td>${formatMoney(data.reconciliation.actual_amount)}</td></tr>
                            <tr><td><strong>Difference</strong></td><td style="color:${parseFloat(data.reconciliation.discrepancy) === 0 ? '#16a34a' : '#dc2626'}"><strong>${formatMoney(data.reconciliation.discrepancy)}</strong></td></tr>
                            <tr><td><strong>Status</strong></td><td>${parseFloat(data.reconciliation.discrepancy) === 0 ? '<span style="color:#16a34a;font-weight:bold">RECONCILED</span>' : '<span style="color:#dc2626;font-weight:bold">DISCREPANCY</span>'}</td></tr>
                        </table>
                    ` : '<p>No reconciliation records found.</p>'}
                </div>
            `;
            container.innerHTML = html;
        } catch (err) {
            console.error(err);
            container.innerHTML = '<p class="error-msg">Failed to load report data.</p>';
        }
    }

    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        window.location.href = '/api/admin/reports/csv';
    });

    document.getElementById('printReportBtn').addEventListener('click', () => {
        window.print();
    });

    // Initial Load
    loadDashboard();
});
