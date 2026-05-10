const SUPABASE_URL = 'https://xzykgsdqmjjtvzqudqfo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7wXQjMhlmrR6Dq2ZnVAWEA_DC4AckGV';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    let currentAdminStatusFilter = null;

    // --- UTILS ---
    async function updateHomeCounters() {
        try {
            const { count: d } = await _supabase.from('denuncias').select('*', { count: 'exact', head: true });
            const { count: s } = await _supabase.from('sugestoes').select('*', { count: 'exact', head: true });
            const { count: r } = await _supabase.from('reclamacoes').select('*', { count: 'exact', head: true });

            document.getElementById('count-denuncia').textContent = `${d || 0} registros`;
            document.getElementById('count-sugestao').textContent = `${s || 0} registros`;
            document.getElementById('count-reclamacao').textContent = `${r || 0} registros`;
            document.getElementById('count-total').textContent = `Total: ${(d || 0) + (s || 0) + (r || 0)}`;
        } catch (err) {
            console.error('Erro ao contar registros:', err);
        }
        updateSafetyBoard();
    }

    async function updateSafetyBoard() {
        try {
            const { data } = await _supabase.from('settings').select('value').eq('key', 'safety_stats').single();
            if (data) {
                const stats = data.value;
                document.getElementById('safety-current-days').textContent = stats.current;
                document.getElementById('safety-record-days').textContent = stats.record;
                
                const inputCurrent = document.getElementById('input-safety-current');
                const inputRecord = document.getElementById('input-safety-record');
                if (inputCurrent) inputCurrent.value = stats.current;
                if (inputRecord) inputRecord.value = stats.record;
            }
        } catch (err) {
            console.error('Erro ao carregar placar:', err);
        }
    }

    function generateTrackingCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    function compressImage(base64Str, maxWidth, callback) {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    }

    function validateForm(formId) {
        const form = document.getElementById(formId);
        const requiredFields = form.querySelectorAll('input[id$="setor"], textarea[id$="descricao"], textarea[id$="texto"], textarea[id$="problema"]');
        let isValid = true;
        form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.closest('.form-group').classList.add('has-error');
                isValid = false;
            }
        });
        return isValid;
    }

    function getStatusClass(status) {
        if (status === 'Em análise') return 'status-analise';
        if (status === 'Resolvido') return 'status-resolvido';
        return 'status-recebido';
    }

    updateHomeCounters();

    // --- NAVIGATION ---
    const sections = document.querySelectorAll('section');
    const navButtons = document.querySelectorAll('[data-nav]');

    function showSection(id) {
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === id) section.classList.add('active');
        });
        window.scrollTo(0, 0);
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = btn.getAttribute('data-nav');
            showSection(target);
            if (target === 'home') updateHomeCounters();
        });
    });

    const toast = document.getElementById('toast');
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    function showSuccess(type, id, code) {
        document.getElementById('success-title').textContent = `${type} enviada!`;
        document.getElementById('success-msg').textContent = `Sua solicitação ${id} foi registrada com sucesso.`;
        document.getElementById('display-tracking-code').textContent = code;
        showSection('success');
    }

    document.getElementById('btn-copy-code').addEventListener('click', () => {
        const code = document.getElementById('display-tracking-code').textContent;
        navigator.clipboard.writeText(code).then(() => showToast('Código copiado!'));
    });

    document.getElementById('btn-copy-reminder').addEventListener('click', () => {
        const code = document.getElementById('display-tracking-code').textContent;
        const msg = `Minha solicitação na CIPA Arouca: código ${code} — acesse o app para acompanhar`;
        navigator.clipboard.writeText(msg).then(() => showToast('Lembrete copiado!'));
    });

    // --- SUBMISSIONS ---
    const inputFoto = document.getElementById('denuncia-foto');
    const previewImg = document.querySelector('#preview-denuncia img');
    let fotoBase64 = null;

    inputFoto?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                compressImage(event.target.result, 800, (compressed) => {
                    fotoBase64 = compressed;
                    previewImg.src = fotoBase64;
                    document.getElementById('preview-denuncia').classList.add('has-image');
                });
            };
            reader.readAsDataURL(file);
        }
    });

    const forms = {
        'form-denuncia': { table: 'denuncias', prefix: 'DN', type: 'Denúncia' },
        'form-sugestao': { table: 'sugestoes', prefix: 'SG', type: 'Sugestão' },
        'form-reclamacao': { table: 'reclamacoes', prefix: 'RC', type: 'Reclamação' }
    };

    Object.keys(forms).forEach(formId => {
        const form = document.getElementById(formId);
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(formId)) return;
            
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const config = forms[formId];
            const { count } = await _supabase.from(config.table).select('*', { count: 'exact', head: true });
            const id = `${config.prefix}-${String((count || 0) + 1).padStart(3, '0')}`;
            const code = generateTrackingCode();

            const entry = {
                id, code,
                data_hora: new Date().toLocaleString('pt-BR'),
                status: 'Recebido',
                setor: document.getElementById(`${formId.split('-')[1]}-setor`)?.value || 'N/A',
                nome: document.getElementById(`${formId.split('-')[1]}-anonimo`)?.checked ? 'Anônimo' : (document.getElementById(`${formId.split('-')[1]}-nome`)?.value || 'Não informado')
            };

            if (formId === 'form-denuncia') {
                entry.descricao = document.getElementById('denuncia-descricao').value;
                entry.foto = fotoBase64;
            } else if (formId === 'form-sugestao') entry.texto = document.getElementById('sugestao-texto').value;
            else entry.problema = document.getElementById('reclamacao-problema').value;

            const { error } = await _supabase.from(config.table).insert([entry]);

            if (error) {
                showToast('Erro ao enviar. Tente novamente.');
                console.error(error);
            } else {
                form.reset();
                if (formId === 'form-denuncia') {
                    document.getElementById('preview-denuncia').classList.remove('has-image');
                    fotoBase64 = null;
                }
                showSuccess(config.type, id, code);
            }
            btn.disabled = false;
            btn.textContent = 'Enviar';
        });
    });

    // --- TRACKING ---
    const btnConsultar = document.getElementById('btn-consultar');
    const trackingInput = document.getElementById('tracking-code-input');
    const trackingResult = document.getElementById('tracking-result');

    btnConsultar.addEventListener('click', async () => {
        const code = trackingInput.value.trim().toUpperCase();
        if (!code) return;

        btnConsultar.disabled = true;
        btnConsultar.textContent = 'Buscando...';

        const queries = [
            _supabase.from('denuncias').select('*').eq('code', code),
            _supabase.from('sugestoes').select('*').eq('code', code),
            _supabase.from('reclamacoes').select('*').eq('code', code)
        ];

        const results = await Promise.all(queries);
        const found = results.find(r => r.data && r.data.length > 0)?.data[0];

        if (!found) {
            trackingResult.innerHTML = '<p class="empty-state">Código não encontrado.</p>';
        } else {
            const type = found.id.startsWith('DN') ? 'denuncia' : (found.id.startsWith('SG') ? 'sugestao' : 'reclamacao');
            const desc = found.descricao || found.texto || found.problema || '';
            const isResolvido = found.status === 'Resolvido';

            trackingResult.innerHTML = `
                <div class="list-item">
                    <div class="item-header">
                        <span class="item-id">${found.id}</span>
                        <span class="item-badge badge-${type}">${type}</span>
                    </div>
                    <div class="item-header" style="margin-top: 10px;">
                        <span class="item-status-badge ${getStatusClass(found.status)}">${found.status}</span>
                        <span class="item-date">${found.data_hora}</span>
                    </div>
                    <div class="item-snippet" style="font-style: normal; margin-top: 10px;">${desc}</div>
                    ${found.resposta ? `
                        <div class="item-response" ${isResolvido ? 'style="border-left-color: #27AE60; background-color: #E9F7EF;"' : ''}>
                            <strong>${isResolvido ? 'SOLUÇÃO CIPA' : 'RESPOSTA CIPA'}:</strong>
                            ${found.resposta}
                        </div>
                    ` : ''}
                </div>
            `;
            lucide.createIcons();
        }
        btnConsultar.disabled = false;
        btnConsultar.textContent = 'Consultar';
    });

    // --- ADMIN ---
    async function getCipaPass() {
        const { data } = await _supabase.from('settings').select('value').eq('key', 'cipa_pass').single();
        return data ? data.value : 'cipa2025';
    }

    document.getElementById('btn-cipa-area').addEventListener('click', async () => {
        const pass = await getCipaPass();
        if (prompt('Senha da CIPA:') === pass) {
            showSection('admin');
            currentAdminStatusFilter = null;
            renderAdminTab('denuncias');
            updateAdminStats();
            updateSafetyBoard();
        } else showToast('Senha incorreta!');
    });

    document.getElementById('btn-admin-sair').addEventListener('click', () => showSection('home'));

    document.getElementById('admin-search-input').addEventListener('input', () => {
        const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab').split('-')[1];
        if (activeTab !== 'config') renderAdminTab(activeTab);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            const type = target.split('-')[1];
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const targetSection = document.getElementById(target);
            if (targetSection) targetSection.classList.add('active');
            if (type !== 'config') renderAdminTab(type);
        });
    });

    async function updateAdminStats() {
        const queries = [
            _supabase.from('denuncias').select('status'),
            _supabase.from('sugestoes').select('status'),
            _supabase.from('reclamacoes').select('status')
        ];
        const results = await Promise.all(queries);
        const all = results.flatMap(r => r.data || []);
        
        const stats = {
            total: all.length,
            recebido: all.filter(i => i.status === 'Recebido').length,
            analise: all.filter(i => i.status === 'Em análise').length,
            resolvido: all.filter(i => i.status === 'Resolvido').length
        };
        
        const container = document.getElementById('admin-stats');
        if (!container) return;

        container.innerHTML = `
            <div class="stat-box ${currentAdminStatusFilter === null ? 'active' : ''}" data-filter="null">
                <strong>${stats.total}</strong><small>Total</small>
            </div>
            <div class="stat-box ${currentAdminStatusFilter === 'Recebido' ? 'active' : ''}" data-filter="Recebido" style="border-bottom: 3px solid #F1C40F;">
                <strong>${stats.recebido}</strong><small>Pendentes</small>
            </div>
            <div class="stat-box ${currentAdminStatusFilter === 'Em análise' ? 'active' : ''}" data-filter="Em análise" style="border-bottom: 3px solid #3498DB;">
                <strong>${stats.analise}</strong><small>Análise</small>
            </div>
            <div class="stat-box ${currentAdminStatusFilter === 'Resolvido' ? 'active' : ''}" data-filter="Resolvido" style="border-bottom: 3px solid #27AE60;">
                <strong>${stats.resolvido}</strong><small>Resolvido</small>
            </div>
        `;

        container.querySelectorAll('.stat-box').forEach(box => {
            box.addEventListener('click', () => {
                const filter = box.getAttribute('data-filter');
                currentAdminStatusFilter = filter === 'null' ? null : filter;
                const activeTabBtn = document.querySelector('.tab-btn.active');
                if (activeTabBtn) {
                    const type = activeTabBtn.getAttribute('data-tab').split('-')[1];
                    if (type !== 'config') renderAdminTab(type);
                }
                updateAdminStats();
            });
        });
    }

    async function renderAdminTab(type) {
        const containerId = `admin-${type}`;
        const container = document.getElementById(containerId);
        if (!container) return;

        const searchTerm = document.getElementById('admin-search-input').value.toLowerCase();
        let query = _supabase.from(type).select('*').order('created_at', { ascending: false });
        
        if (currentAdminStatusFilter) {
            query = query.eq('status', currentAdminStatusFilter);
        }

        const { data: items } = await query;
        if (!items) return;

        const filtered = items.filter(i => (i.id.toLowerCase().includes(searchTerm) || (i.setor && i.setor.toLowerCase().includes(searchTerm))));

        if (filtered.length === 0) {
            const msg = currentAdminStatusFilter ? `Nenhum registro com status "${currentAdminStatusFilter}".` : (searchTerm ? 'Nenhum resultado.' : 'Nenhum registro.');
            container.innerHTML = `<p class="empty-state">${msg}</p>`;
            return;
        }

        const singularType = type.replace('denuncias', 'denuncia').replace('sugestoes', 'sugestao').replace('reclamacoes', 'reclamacao');

        container.innerHTML = filtered.map(item => `
            <div class="admin-card">
                <div class="item-header">
                    <span class="item-id">${item.id}</span>
                    <span class="code-badge">Cód: ${item.code}</span>
                </div>
                <div class="item-info"><strong>Quem:</strong> ${item.nome} | <strong>Setor:</strong> ${item.setor}</div>
                <div class="item-info" style="margin-top: 5px;">${item.descricao || item.texto || item.problema}</div>
                ${item.foto ? `<img src="${item.foto}" class="item-photo-mini" style="max-width: 100px; border-radius: 8px; margin-top: 10px; display: block;">` : ''}
                <div class="admin-controls">
                    <select class="admin-status-select" data-id="${item.id}" data-type="${singularType}">
                        <option value="Recebido" ${item.status === 'Recebido' ? 'selected' : ''}>Recebido</option>
                        <option value="Em análise" ${item.status === 'Em análise' ? 'selected' : ''}>Em análise</option>
                        <option value="Resolvido" ${item.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                    </select>
                    <textarea class="admin-response-area" data-id="${item.id}" data-type="${singularType}" placeholder="Responder ao funcionário...">${item.resposta || ''}</textarea>
                    <button class="btn-admin-save" onclick="salvarStatusAdmin('${item.id}', '${singularType}')">Salvar</button>
                    ${item.status === 'Resolvido' ? `
                        <button class="btn-admin-delete" onclick="excluirRegistro('${item.id}', '${singularType}')">
                            <i data-lucide="trash-2" style="width: 20px; height: 20px;"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="item-date">${item.data_hora}</div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.salvarStatusAdmin = async (id, type) => {
        const table = type === 'denuncia' ? 'denuncias' : (type === 'sugestao' ? 'sugestoes' : 'reclamacoes');
        const select = document.querySelector(`select[data-id="${id}"]`);
        const textarea = document.querySelector(`textarea[data-id="${id}"]`);
        
        const { error } = await _supabase.from(table).update({
            status: select.value,
            resposta: textarea.value
        }).eq('id', id);

        if (error) showToast('Erro ao salvar.');
        else {
            showToast('Salvo com sucesso!');
            renderAdminTab(table);
            updateAdminStats();
        }
    };

    window.excluirRegistro = async (id, type) => {
        if (confirm(`Excluir o registro ${id}?`)) {
            const table = type === 'denuncia' ? 'denuncias' : (type === 'sugestao' ? 'sugestoes' : 'reclamacoes');
            const { error } = await _supabase.from(table).delete().eq('id', id);
            if (error) showToast('Erro ao excluir.');
            else {
                showToast('Registro excluído!');
                renderAdminTab(table);
                updateAdminStats();
                updateHomeCounters();
            }
        }
    };

    ['denuncia', 'reclamacao'].forEach(type => {
        document.getElementById(`${type}-anonimo`)?.addEventListener('change', (e) => {
            const input = document.getElementById(`${type}-nome`);
            if (input) {
                input.value = '';
                input.disabled = e.target.checked;
            }
        });
    });

    document.getElementById('btn-change-pass').addEventListener('click', async () => {
        const atual = document.getElementById('pass-atual').value;
        const nova = document.getElementById('pass-nova').value;
        const pass = await getCipaPass();
        if (atual === pass) {
            const { error } = await _supabase.from('settings').update({ value: nova }).eq('key', 'cipa_pass');
            if (error) showToast('Erro ao salvar.');
            else {
                showToast('Senha alterada!');
                document.getElementById('pass-atual').value = '';
                document.getElementById('pass-nova').value = '';
            }
        } else showToast('Senha atual incorreta!');
    });

    document.getElementById('btn-save-safety').addEventListener('click', async () => {
        const current = parseInt(document.getElementById('input-safety-current').value || 0);
        const record = parseInt(document.getElementById('input-safety-record').value || 0);
        const { error } = await _supabase.from('settings').update({ value: { current, record } }).eq('key', 'safety_stats');
        if (error) showToast('Erro ao salvar.');
        else {
            updateSafetyBoard();
            showToast('Placar atualizado!');
        }
    });
});
