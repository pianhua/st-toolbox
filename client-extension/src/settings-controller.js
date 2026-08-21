export class SettingsController {
    constructor(apiPrefix, getHeaders, toolRegistry, onConfigUpdated) {
        this.apiPrefix = apiPrefix;
        this.getHeaders = getHeaders;
        this.toolRegistry = toolRegistry;
        this.onConfigUpdated = onConfigUpdated;
        this.logs = [];
        this.config = null;
    }

    async init() {
        this.bindEvents();
        await this.loadConfig();
        await this.loadTrash();
    }

    bindEvents() {
        $('#st-toolbox-save').off('click').on('click', () => this.saveConfig());
        $('#st-toolbox-reload').off('click').on('click', () => this.loadConfig());
        $('#st-toolbox-test-path-btn').off('click').on('click', () => this.testPath());
        $('#st-toolbox-refresh-trash').off('click').on('click', () => this.loadTrash());
        $('#st-toolbox-clear-logs').off('click').on('click', () => this.clearLogs());

        // Quick add buttons
        $('.st-toolbox-quick-add').off('click').on('click', (e) => {
            const pathToAdd = $(e.currentTarget).data('path');
            if (pathToAdd) {
                const current = $('#st-toolbox-allowed-paths').val();
                const lines = current.split('\n').map(s => s.trim()).filter(Boolean);
                if (!lines.includes(pathToAdd)) {
                    lines.push(pathToAdd);
                    $('#st-toolbox-allowed-paths').val(lines.join('\n'));
                }
            }
        });

        // Tab switching
        $('.st-toolbox-tab-btn').off('click').on('click', (e) => {
            const tabId = $(e.currentTarget).data('tab');
            $('.st-toolbox-tab-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
            $('.st-toolbox-tab-content').hide();
            $(`#st-toolbox-tab-${tabId}`).show();
        });
    }

    showStatus(message, type = 'info') {
        const el = $('#st-toolbox-status');
        el.text(message).removeClass('success error info').addClass(type).fadeIn();
        setTimeout(() => el.fadeOut(), 3500);
    }

    async loadConfig() {
        try {
            const res = await fetch(`${this.apiPrefix}/config`, {
                method: 'GET',
                headers: this.getHeaders ? this.getHeaders() : {},
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            this.config = await res.json();

            // Populate allowed paths
            const paths = this.config.allowedPaths || [];
            $('#st-toolbox-allowed-paths').val(paths.join('\n'));

            // Populate tool toggles
            const enabledTools = this.config.enabledTools || {};
            $('.st-toolbox-tool-toggle').each(function () {
                const toolName = $(this).data('tool');
                const isEnabled = enabledTools[toolName] !== false; // Default true
                $(this).prop('checked', isEnabled);
            });

            this.showStatus('配置已加载成功', 'success');
            if (this.onConfigUpdated) this.onConfigUpdated(this.config);
        } catch (err) {
            console.error('[ST-Toolbox] Failed to load config:', err);
            this.showStatus(`加载配置失败: ${err.message}`, 'error');
        }
    }

    async saveConfig() {
        try {
            const rawPaths = $('#st-toolbox-allowed-paths').val() || '';
            const allowedPaths = rawPaths
                .split('\n')
                .map(p => p.trim())
                .filter(p => p.length > 0);

            const enabledTools = {};
            $('.st-toolbox-tool-toggle').each(function () {
                const toolName = $(this).data('tool');
                enabledTools[toolName] = $(this).is(':checked');
            });

            const payload = {
                allowedPaths,
                enabledTools,
            };

            const res = await fetch(`${this.apiPrefix}/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.getHeaders ? this.getHeaders() : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || res.statusText);
            }

            const data = await res.json();
            this.config = data.config;

            this.showStatus(`配置保存成功！白名单包含 ${allowedPaths.length} 个路径。`, 'success');
            if (this.onConfigUpdated) this.onConfigUpdated(this.config);
        } catch (err) {
            console.error('[ST-Toolbox] Failed to save config:', err);
            this.showStatus(`保存失败: ${err.message}`, 'error');
        }
    }

    async testPath() {
        const testPath = $('#st-toolbox-test-input').val()?.trim();
        if (!testPath) {
            this.showStatus('请输入要测试的路径', 'info');
            return;
        }

        try {
            const res = await fetch(`${this.apiPrefix}/config/test-path`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.getHeaders ? this.getHeaders() : {}),
                },
                body: JSON.stringify({ testPath }),
            });

            const result = await res.json();
            const resultEl = $('#st-toolbox-test-result');

            if (result.valid) {
                resultEl.html(`<span style="color:#28a745;"><i class="fa-solid fa-check-circle"></i> 路径合法有效: ${result.resolvedPath}</span>`);
            } else {
                resultEl.html(`<span style="color:#dc3545;"><i class="fa-solid fa-times-circle"></i> ${result.error}</span>`);
            }
        } catch (err) {
            $('#st-toolbox-test-result').html(`<span style="color:#dc3545;">测试失败: ${err.message}</span>`);
        }
    }

    async loadTrash() {
        try {
            const res = await fetch(`${this.apiPrefix}/trash`, {
                headers: this.getHeaders ? this.getHeaders() : {},
            });
            if (!res.ok) return;

            const list = await res.json();
            const container = $('#st-toolbox-trash-list');
            container.empty();

            if (!Array.isArray(list) || list.length === 0) {
                container.html('<div style="opacity:0.6; padding:10px;">回收站暂无文件</div>');
                return;
            }

            list.forEach(item => {
                const dateStr = new Date(item.trashedAt).toLocaleString();
                const row = $(`
                    <div class="st-toolbox-trash-item">
                        <div class="trash-info">
                            <b>${item.fileName}</b>
                            <small>${item.originalPath} (${dateStr})</small>
                        </div>
                        <button class="menu_button restore-btn" data-id="${item.trashId}">
                            <i class="fa-solid fa-rotate-left"></i> 恢复
                        </button>
                    </div>
                `);

                row.find('.restore-btn').on('click', async (e) => {
                    const id = $(e.currentTarget).data('id');
                    await this.restoreTrash(id);
                });

                container.append(row);
            });
        } catch (e) {
            console.error('[ST-Toolbox] Error loading trash:', e);
        }
    }

    async restoreTrash(identifier) {
        try {
            const res = await fetch(`${this.apiPrefix}/trash/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.getHeaders ? this.getHeaders() : {}),
                },
                body: JSON.stringify({ identifier }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || res.statusText);
            }

            const data = await res.json();
            this.showStatus(`已恢复: ${data.restoredPath}`, 'success');
            await this.loadTrash();
        } catch (e) {
            this.showStatus(`恢复失败: ${e.message}`, 'error');
        }
    }

    addLog(endpoint, payload, result, duration, isSuccess) {
        const entry = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            endpoint,
            payload,
            result,
            duration,
            isSuccess,
        };

        this.logs.unshift(entry);
        if (this.logs.length > 50) this.logs.pop();

        this.renderLogs();
    }

    renderLogs() {
        const container = $('#st-toolbox-logs-list');
        if (!container.length) return;
        container.empty();

        if (this.logs.length === 0) {
            container.html('<div style="opacity:0.6; padding:10px;">暂无调用记录</div>');
            return;
        }

        this.logs.forEach(log => {
            const icon = log.isSuccess ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger';
            const logItem = $(`
                <div class="st-toolbox-log-item">
                    <div class="log-header">
                        <span><i class="fa-solid ${icon}"></i> <b>${log.endpoint}</b> (${log.duration}ms)</span>
                        <small>${log.time}</small>
                    </div>
                    <details class="log-details">
                        <summary>查看参数与返回值</summary>
                        <pre><code>参数: ${JSON.stringify(log.payload, null, 2)}\n\n结果: ${typeof log.result === 'object' ? JSON.stringify(log.result, null, 2) : log.result}</code></pre>
                    </details>
                </div>
            `);
            container.append(logItem);
        });
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
    }
}
