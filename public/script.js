document.addEventListener('DOMContentLoaded', function() {
    // 配置
    const API_BASE_URL = '/api';
    const STORAGE_KEY = 'azure_dns_credentials';
    
    // DOM Elements
    const connectBtn = document.getElementById('connectBtn');
    const zoneList = document.getElementById('zoneList');
    const recordsList = document.getElementById('recordsList');
    const selectedZoneElement = document.getElementById('selectedZone');
    const addRecordBtn = document.getElementById('addRecordBtn');
    const addRecordModal = document.getElementById('addRecordModal');
    const editRecordModal = document.getElementById('editRecordModal');
    const saveRecordBtn = document.getElementById('saveRecordBtn');
    const updateRecordBtn = document.getElementById('updateRecordBtn');
    const closeButtons = document.querySelectorAll('.close');
    const clearCredsBtn = document.getElementById('clearCredsBtn');
    
    // Application State
    let state = {
        isAuthenticated: false,
        tenantId: '',
        clientId: '',
        clientSecret: '',
        subscriptionId: '',
        selectedZone: null,
        zones: [],
        records: []
    };
    
    // 页面加载时尝试恢复保存的凭据
    loadSavedCredentials();
    
    // Event Listeners
    connectBtn.addEventListener('click', authenticateToAzure);
    addRecordBtn.addEventListener('click', () => showModal(addRecordModal));
    saveRecordBtn.addEventListener('click', addDnsRecord);
    updateRecordBtn.addEventListener('click', updateDnsRecord);
    clearCredsBtn.addEventListener('click', clearSavedCredentials);
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            hideModal(modal);
        });
    });
    
    // When clicking outside of the modal, close it
    window.addEventListener('click', function(event) {
        if (event.target === addRecordModal) {
            hideModal(addRecordModal);
        }
        if (event.target === editRecordModal) {
            hideModal(editRecordModal);
        }
    });
    
    // 保存凭据到本地存储
    function saveCredentials() {
        const credentials = {
            tenantId: state.tenantId,
            clientId: state.clientId,
            clientSecret: state.clientSecret,
            subscriptionId: state.subscriptionId,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
            console.log('凭据已保存到本地存储');
        } catch (error) {
            console.warn('无法保存凭据到本地存储:', error);
        }
    }
    
    // 从本地存储加载凭据
    function loadSavedCredentials() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const credentials = JSON.parse(saved);
                
                // 检查凭据是否过期（可选：7天后过期）
                const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - credentials.timestamp > SEVEN_DAYS) {
                    console.log('保存的凭据已过期，已清除');
                    localStorage.removeItem(STORAGE_KEY);
                    return;
                }
                
                // 填充表单字段
                document.getElementById('tenantId').value = credentials.tenantId || '';
                document.getElementById('clientId').value = credentials.clientId || '';
                document.getElementById('clientSecret').value = credentials.clientSecret || '';
                document.getElementById('subscriptionId').value = credentials.subscriptionId || '';
                
                // 更新状态
                state.tenantId = credentials.tenantId || '';
                state.clientId = credentials.clientId || '';
                state.clientSecret = credentials.clientSecret || '';
                state.subscriptionId = credentials.subscriptionId || '';
                
                // 显示提示信息
                showCredentialsStatus('已加载保存的凭据');
                
                // 如果所有必填字段都有值，可以选择自动连接
                if (credentials.tenantId && credentials.clientId && credentials.clientSecret && credentials.subscriptionId) {
                    connectBtn.textContent = '重新连接';
                }
            }
        } catch (error) {
            console.warn('无法加载保存的凭据:', error);
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    
    // 清除保存的凭据
    function clearSavedCredentials() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            
            // 清空表单
            document.getElementById('tenantId').value = '';
            document.getElementById('clientId').value = '';
            document.getElementById('clientSecret').value = '';
            document.getElementById('subscriptionId').value = '';
            
            // 重置状态
            state = {
                isAuthenticated: false,
                tenantId: '',
                clientId: '',
                clientSecret: '',
                subscriptionId: '',
                selectedZone: null,
                zones: [],
                records: []
            };
            
            // 重置UI
            connectBtn.textContent = '连接';
            connectBtn.classList.remove('connected');
            connectBtn.disabled = false;
            zoneList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌐</div><p>请先连接到 Azure 以加载 DNS 区域</p></div>';
            recordsList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><p>选择左侧的 DNS 区域以查看记录</p></div>';
            selectedZoneElement.textContent = '请选择一个区域';
            addRecordBtn.style.display = 'none';
            
            showCredentialsStatus('已清除保存的凭据');
        } catch (error) {
            console.warn('清除凭据时出错:', error);
        }
    }
    
    // 显示凭据状态信息
    function showCredentialsStatus(message) {
        let statusElement = document.getElementById('credentialsStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'credentialsStatus';
            statusElement.className = 'credentials-status';
            
            const authSection = document.querySelector('.auth-section');
            authSection.insertBefore(statusElement, authSection.firstChild.nextSibling);
        }
        
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }
    
    // Azure Authentication
    async function authenticateToAzure() {
        const tenantId = document.getElementById('tenantId').value;
        const clientId = document.getElementById('clientId').value;
        const clientSecret = document.getElementById('clientSecret').value;
        const subscriptionId = document.getElementById('subscriptionId').value;
        
        if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
            alert('请填写所有必填凭据字段');
            return;
        }
        
        // Store credentials in state
        state.tenantId = tenantId;
        state.clientId = clientId;
        state.clientSecret = clientSecret;
        state.subscriptionId = subscriptionId;
        
        // 认证中状态
        connectBtn.disabled = true;
        connectBtn.textContent = '连接中...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId,
                    clientId,
                    clientSecret,
                    subscriptionId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 认证成功
                state.isAuthenticated = true;
                
                // 保存凭据到本地存储
                saveCredentials();
                
                connectBtn.textContent = '已连接';
                connectBtn.classList.add('connected');
                
                // 加载DNS区域
                loadDnsZones();
                
                showCredentialsStatus('认证成功，凭据已保存');
            } else {
                // 认证失败
                alert(`认证失败: ${data.error}\n${data.details || ''}`);
                connectBtn.disabled = false;
                connectBtn.textContent = '连接';
            }
        } catch (error) {
            console.error('认证请求错误:', error);
            alert(`连接服务器失败: ${error.message}\n请确保后端服务已启动并运行在http://localhost:3000`);
            connectBtn.disabled = false;
            connectBtn.textContent = '连接';
        }
    }
    
    // Load DNS Zones
    async function loadDnsZones() {
        zoneList.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>加载 DNS 区域...</p>
            </div>
        `;
        
        try {
            const response = await fetch(`${API_BASE_URL}/zones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId: state.tenantId,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    subscriptionId: state.subscriptionId
                })
            });
            
            const zones = await response.json();
            
            if (Array.isArray(zones)) {
                state.zones = zones;
                renderZoneList();
            } else {
                alert(`加载区域失败: ${zones.error}\n${zones.details || ''}`);
                zoneList.innerHTML = '<p>加载区域失败，请重试</p>';
            }
        } catch (error) {
            console.error('加载区域错误:', error);
            alert(`加载区域失败: ${error.message}`);
            zoneList.innerHTML = '<p>加载区域失败，请重试</p>';
        }
    }
    
    // Render DNS Zones List
    function renderZoneList() {
        if (state.zones.length === 0) {
            zoneList.innerHTML = '<p>没有可用的 DNS 区域</p>';
            return;
        }
        
        let zonesHtml = '';
        
        state.zones.forEach(zone => {
            zonesHtml += `
                <div class="zone-item" 
                     data-id="${zone.id}" 
                     data-name="${zone.name}" 
                     data-resource-group="${zone.resourceGroup}">
                    <div class="zone-info">
                        <h3>${zone.name}</h3>
                        <p>资源组: ${zone.resourceGroup}</p>
                    </div>
                    <button class="select-zone-btn">选择</button>
                </div>
            `;
        });
        
        zoneList.innerHTML = zonesHtml;
        
        // Add event listeners to zone select buttons
        const selectZoneBtns = document.querySelectorAll('.select-zone-btn');
        selectZoneBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const zoneItem = this.closest('.zone-item');
                const zoneId = zoneItem.dataset.id;
                const zoneName = zoneItem.dataset.name;
                const resourceGroup = zoneItem.dataset.resourceGroup;
                
                // Remove active class from all zone items
                document.querySelectorAll('.zone-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to selected zone
                zoneItem.classList.add('active');
                
                // Update selected zone in state
                state.selectedZone = { 
                    id: zoneId, 
                    name: zoneName,
                    resourceGroup: resourceGroup
                };
                
                // Update UI
                selectedZoneElement.textContent = zoneName;
                addRecordBtn.style.display = 'block';
                
                // Load DNS records for the selected zone
                loadDnsRecords(zoneName, resourceGroup);
            });
        });
    }
    
    // Load DNS Records for a Zone
    async function loadDnsRecords(zoneName, resourceGroup) {
        recordsList.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>加载 DNS 记录...</p>
            </div>
        `;
        
        try {
            const response = await fetch(`${API_BASE_URL}/records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId: state.tenantId,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    subscriptionId: state.subscriptionId,
                    zoneName: zoneName,
                    resourceGroup: resourceGroup
                })
            });
            
            const records = await response.json();
            
            if (Array.isArray(records)) {
                state.records = records;
                renderRecordsList();
            } else {
                alert(`加载记录失败: ${records.error}\n${records.details || ''}`);
                recordsList.innerHTML = '<p>加载记录失败，请重试</p>';
            }
        } catch (error) {
            console.error('加载记录错误:', error);
            alert(`加载记录失败: ${error.message}`);
            recordsList.innerHTML = '<p>加载记录失败，请重试</p>';
        }
    }
    
    // Render DNS Records List
    function renderRecordsList() {
        if (!state.selectedZone) {
            recordsList.innerHTML = '<p>请先选择一个 DNS 区域</p>';
            return;
        }
        
        if (state.records.length === 0) {
            recordsList.innerHTML = '<p>没有可用的 DNS 记录</p>';
            return;
        }
        
        let recordsHtml = '';
        
        state.records.forEach(record => {
            recordsHtml += `
                <div class="record-item" data-id="${record.id}">
                    <div class="record-info">
                        <div class="record-header">
                            <span class="record-name">${record.name}</span>
                            <span class="record-type ${record.type}">${record.type}</span>
                        </div>
                        <div class="record-details">
                            <p>值: ${record.value}</p>
                            <p>TTL: ${record.ttl} 秒</p>
                        </div>
                    </div>
                    <div class="record-actions">
                        <button class="edit-btn" data-id="${record.id}">编辑</button>
                        <button class="delete-btn" data-id="${record.id}">删除</button>
                    </div>
                </div>
            `;
        });
        
        recordsList.innerHTML = recordsHtml;
        
        // Add event listeners to record action buttons
        const editBtns = document.querySelectorAll('.edit-btn');
        const deleteBtns = document.querySelectorAll('.delete-btn');
        
        editBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = this.dataset.id;
                const record = state.records.find(r => r.id === recordId);
                
                if (record) {
                    document.getElementById('editRecordName').value = record.name;
                    document.getElementById('editRecordType').value = record.type;
                    document.getElementById('editRecordValue').value = record.value;
                    document.getElementById('editRecordTTL').value = record.ttl;
                    document.getElementById('editRecordId').value = record.id;
                    
                    showModal(editRecordModal);
                }
            });
        });
        
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = this.dataset.id;
                const record = state.records.find(r => r.id === recordId);
                
                if (record && confirm(`确定要删除 ${record.name} (${record.type}) 记录吗?`)) {
                    deleteDnsRecord(record);
                }
            });
        });
    }
    
    // Add DNS Record
    async function addDnsRecord() {
        if (!state.selectedZone) {
            alert('请先选择一个 DNS 区域');
            return;
        }
        
        const recordName = document.getElementById('recordName').value;
        const recordType = document.getElementById('recordType').value;
        const recordValue = document.getElementById('recordValue').value;
        const recordTTL = document.getElementById('recordTTL').value;
        
        if (!recordName || !recordType || !recordValue || !recordTTL) {
            alert('请填写所有必填字段');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/records/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId: state.tenantId,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    subscriptionId: state.subscriptionId,
                    zoneName: state.selectedZone.name,
                    resourceGroup: state.selectedZone.resourceGroup,
                    recordName: recordName,
                    recordType: recordType,
                    recordValue: recordValue,
                    recordTTL: parseInt(recordTTL)
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                loadDnsRecords(state.selectedZone.name, state.selectedZone.resourceGroup);
                
                document.getElementById('recordName').value = '';
                document.getElementById('recordType').selectedIndex = 0;
                document.getElementById('recordValue').value = '';
                document.getElementById('recordTTL').value = '3600';
                
                hideModal(addRecordModal);
                alert('DNS 记录添加成功');
            } else {
                alert(`添加记录失败: ${result.error}\n${result.details || ''}`);
            }
        } catch (error) {
            console.error('添加记录错误:', error);
            alert(`添加记录失败: ${error.message}`);
        }
    }
    
    // Update DNS Record
    async function updateDnsRecord() {
        const recordId = document.getElementById('editRecordId').value;
        const recordName = document.getElementById('editRecordName').value;
        const recordType = document.getElementById('editRecordType').value;
        const recordValue = document.getElementById('editRecordValue').value;
        const recordTTL = document.getElementById('editRecordTTL').value;
        
        if (!recordName || !recordType || !recordValue || !recordTTL) {
            alert('请填写所有必填字段');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/records/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId: state.tenantId,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    subscriptionId: state.subscriptionId,
                    zoneName: state.selectedZone.name,
                    resourceGroup: state.selectedZone.resourceGroup,
                    recordName: recordName,
                    recordType: recordType,
                    recordValue: recordValue,
                    recordTTL: parseInt(recordTTL),
                    recordId: recordId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                loadDnsRecords(state.selectedZone.name, state.selectedZone.resourceGroup);
                hideModal(editRecordModal);
                alert('DNS 记录更新成功');
            } else {
                alert(`更新记录失败: ${result.error}\n${result.details || ''}`);
            }
        } catch (error) {
            console.error('更新记录错误:', error);
            alert(`更新记录失败: ${error.message}`);
        }
    }
    
    // Delete DNS Record
    async function deleteDnsRecord(record) {
        try {
            const response = await fetch(`${API_BASE_URL}/records/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId: state.tenantId,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    subscriptionId: state.subscriptionId,
                    zoneName: state.selectedZone.name,
                    resourceGroup: state.selectedZone.resourceGroup,
                    recordName: record.name,
                    recordType: record.type
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                loadDnsRecords(state.selectedZone.name, state.selectedZone.resourceGroup);
                alert('DNS 记录删除成功');
            } else {
                alert(`删除记录失败: ${result.error}\n${result.details || ''}`);
            }
        } catch (error) {
            console.error('删除记录错误:', error);
            alert(`删除记录失败: ${error.message}`);
        }
    }
    
    // Helper function to show a modal
    function showModal(modal) {
        modal.style.display = 'block';
    }
    
    // Helper function to hide a modal
    function hideModal(modal) {
        modal.style.display = 'none';
    }
});