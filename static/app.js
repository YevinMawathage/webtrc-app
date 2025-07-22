class WebRTCChat {
    constructor() {
        this.ws = null;
        this.localStream = null;
        this.currentUser = null;
        this.currentChannel = 'general';
        this.isMuted = false;
        this.isLoggedIn = false;
        this.peerConnections = new Map();
        this.remoteVideoTracks = new Map(); // Track video tracks per user
        this.isScreenSharing = false;
        
        // Sound effects
        this.sounds = {
            mute: null,
            unmute: null,
            disconnect: null
        };
        
        this.initUI();
        this.setupEventListeners();
        this.initSounds();
        this.initScreenSharing(); // Initialize screen sharing features
        this.checkExistingSession(); // Check for existing session on load
    }

    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9);
    }

    initUI() {
        this.authSection = document.getElementById('auth-section');
        this.chatSection = document.getElementById('chat-section');
        this.loginTab = document.getElementById('login-tab');
        this.registerTab = document.getElementById('register-tab');
        this.authForm = document.getElementById('auth-form');
        this.authSubmit = document.getElementById('auth-submit');
        this.authMessage = document.getElementById('auth-message');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.messagesDiv = document.getElementById('messages');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.disconnectBtn = document.getElementById('disconnect-btn');
        this.currentUserSpan = document.getElementById('current-user');
        this.currentChannelSpan = document.getElementById('current-channel');
        this.usersList = document.getElementById('users-list');
        this.channelsList = document.getElementById('channels-list');
        this.remoteAudioContainer = document.getElementById('remote-audio-container');
        this.userCountSpan = document.getElementById('user-count');
        
        // Video elements
        this.videoContainer = document.getElementById('video-container');
        this.localVideo = document.getElementById('local-video');
        this.remoteVideo = document.getElementById('remote-video');
        this.videoBtn = document.getElementById('video-btn');
        this.screenShareBtn = document.getElementById('screen-share-btn');

        // Video popup elements
        this.videoPopupModal = document.getElementById('video-popup-modal');
        this.popupMainVideo = document.getElementById('popup-main-video');
        this.popupLocalVideo = document.getElementById('popup-local-video');
        this.closeVideoPopup = document.getElementById('close-video-popup');
        this.minimizeVideo = document.getElementById('minimize-video');
        this.minimizedVideoIndicator = document.getElementById('minimized-video-indicator');
        this.videoPopupTitle = document.getElementById('video-popup-title');
        this.mainVideoUsername = document.getElementById('main-video-username');
        this.activeParticipantsCount = document.getElementById('active-participants-count');
        this.videoParticipantsContainer = document.getElementById('video-participants-container');

        // Video chat state
        this.videoParticipants = new Map(); // Track all video participants
        this.currentMainVideoUser = null; // Currently featured user

        // Mobile UI elements
        this.sidebar = document.getElementById('sidebar');
        this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
        this.closeSidebarBtn = document.getElementById('close-sidebar');
        this.mobileOverlay = document.getElementById('mobile-overlay');

        // Initialize button states
        this.initializeButtonStates();
    }

    initializeButtonStates() {
        // Initialize mute button
        if (this.muteBtn) {
            this.muteBtn.classList.add('bg-green-500/80');
            this.muteBtn.innerHTML = '<span class="hidden sm:inline">Mute</span>';
        }

        // Initialize video button  
        if (this.videoBtn) {
            this.videoBtn.classList.add('bg-gray-700/80');
            this.videoBtn.innerHTML = '<span class="hidden sm:inline">Video</span>';
        }

        // Initialize screen share button
        if (this.screenShareBtn) {
            this.screenShareBtn.classList.add('bg-gray-700/80');
            this.screenShareBtn.innerHTML = '<span class="hidden sm:inline">Share</span>';
        }
    }

    initSounds() {
        // Create simple beep sounds for better compatibility
        this.createSimpleSounds();
    }

    createSimpleSounds() {
        // Create audio context only when needed
        this.audioContext = null;
        
        // Store sound parameters instead of pre-generated audio
        this.soundParams = {
            mute: { frequency: 800, duration: 0.15, type: 'descending' },
            unmute: { frequency: 400, duration: 0.15, type: 'ascending' },
            disconnect: { frequency: 600, duration: 0.3, type: 'declining' }
        };
    }

    async initScreenSharing() {
        // Check if screen sharing is supported
        if (!this.isScreenSharingSupported()) {
            console.log('Screen sharing not supported in this browser');
            if (this.screenShareBtn) {
                this.screenShareBtn.disabled = true;
                this.screenShareBtn.title = 'Screen sharing not supported in this browser';
                this.screenShareBtn.innerHTML = '<span class="text-sm opacity-50">N/A</span><span class="hidden sm:inline opacity-50">N/A</span>';
            }
            return;
        }

        // Get and log capabilities
        try {
            const capabilities = await this.getScreenSharingCapabilities();
            console.log('Screen sharing capabilities:', capabilities);
            
            if (this.screenShareBtn) {
                this.screenShareBtn.title = 'Share your screen with other participants';
            }
        } catch (error) {
            console.error('Error checking screen sharing capabilities:', error);
        }
    }

    async playSound(soundName) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume audio context if suspended (due to autoplay policies)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const params = this.soundParams[soundName];
            if (!params) return;

            // Create oscillator and gain nodes
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            // Connect nodes
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Set initial frequency
            oscillator.frequency.setValueAtTime(params.frequency, this.audioContext.currentTime);
            
            // Configure frequency changes based on sound type
            const now = this.audioContext.currentTime;
            const endTime = now + params.duration;
            
            if (params.type === 'descending') {
                oscillator.frequency.exponentialRampToValueAtTime(params.frequency * 0.5, endTime);
            } else if (params.type === 'ascending') {
                oscillator.frequency.exponentialRampToValueAtTime(params.frequency * 2, endTime);
            } else if (params.type === 'declining') {
                oscillator.frequency.exponentialRampToValueAtTime(params.frequency * 0.3, endTime);
            }
            
            // Set envelope
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01); // Quick attack
            gainNode.gain.exponentialRampToValueAtTime(0.001, endTime); // Fade out
            
            // Set oscillator type
            oscillator.type = 'sine';
            
            // Start and stop
            oscillator.start(now);
            oscillator.stop(endTime);
            
        } catch (error) {
            console.log('Sound play error:', error);
            // Fallback to a simple console notification for development
            console.log(`Sound ${soundName} played`);
        }
    }

    setupEventListeners() {
        // Add one-time user interaction listener to enable audio context
        const enableAudio = () => {
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.log('Audio context creation failed:', e);
                }
            }
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
        };
        document.addEventListener('click', enableAudio);
        document.addEventListener('keydown', enableAudio);
        
        this.loginTab.addEventListener('click', () => this.switchTab('login'));
        this.registerTab.addEventListener('click', () => this.switchTab('register'));
        this.authForm.addEventListener('submit', (e) => this.handleAuth(e));
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.videoBtn.addEventListener('click', () => this.toggleVideo());
        this.screenShareBtn.addEventListener('click', () => {
            if (this.isScreenSharing) {
                this.toggleScreenShare();
            } else {
                this.startScreenShareWithFeedback();
            }
        });
        
        // Video popup event listeners
        if (this.closeVideoPopup) {
            this.closeVideoPopup.addEventListener('click', () => this.closeVideoPopupModal());
        }
        
        if (this.minimizeVideo) {
            this.minimizeVideo.addEventListener('click', () => this.minimizeVideoPopup());
        }
        
        if (this.minimizedVideoIndicator) {
            this.minimizedVideoIndicator.addEventListener('click', () => this.restoreVideoPopup());
        }

        // Add drag functionality to video popup
        this.setupVideoPopupDrag();
        
        this.channelsList.addEventListener('click', (e) => {
            const channelItem = e.target.closest('.channel-item');
            if (channelItem) {
                const channel = channelItem.dataset.channel;
                this.joinChannel(channel);
            }
        });

        // Mobile sidebar event listeners
        if (this.mobileMenuBtn) {
            this.mobileMenuBtn.addEventListener('click', () => this.openMobileSidebar());
        }
        
        if (this.closeSidebarBtn) {
            this.closeSidebarBtn.addEventListener('click', () => this.closeMobileSidebar());
        }
        
        if (this.mobileOverlay) {
            this.mobileOverlay.addEventListener('click', () => this.closeMobileSidebar());
        }

        // Close sidebar on window resize to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileSidebar();
            }
        });

        // Password visibility toggle
        const passwordToggle = document.querySelector('button[title="Show password"]');
        if (passwordToggle) {
            passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
        }
    }

    switchTab(tab) {
        if (tab === 'login') {
            this.loginTab.classList.add('active');
            this.registerTab.classList.remove('active');
            this.authSubmit.querySelector('#submit-text').textContent = 'Sign In';
        } else {
            this.registerTab.classList.add('active');
            this.loginTab.classList.remove('active');
            this.authSubmit.querySelector('#submit-text').textContent = 'Sign Up';
        }
    }

    async handleAuth(e) {
        e.preventDefault();
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        const isLogin = this.authSubmit.querySelector('#submit-text').textContent === 'Sign In';
        
        if (!username || !password) {
            this.showAuthMessage('Please fill in all fields', 'error');
            return;
        }

        // Add loading state
        this.authSubmit.classList.add('loading');
        this.authSubmit.disabled = true;

        try {
            const response = await fetch(isLogin ? '/login' : '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                if (isLogin) {
                    this.currentUser = data.user.username;
                    this.isLoggedIn = true;
                    
                    // Store JWT token in localStorage
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.setItem('username', data.user.username);
                    
                    this.showAuthMessage('Login successful!', 'success');
                    await this.initializeChat();
                } else {
                    this.showAuthMessage('Registration successful! Please login.', 'success');
                    this.switchTab('login');
                }
            } else {
                this.showAuthMessage(data.message || 'Authentication failed', 'error');
            }
        } catch (error) {
            this.showAuthMessage('Network error. Please try again.', 'error');
        } finally {
            // Remove loading state
            this.authSubmit.classList.remove('loading');
            this.authSubmit.disabled = false;
        }
    }

    showAuthMessage(message, type) {
        this.authMessage.textContent = message;
        this.authMessage.className = `mt-6 text-center font-medium transition-all duration-300 ${type === 'error' ? 'text-red-400' : 'text-green-400'}`;
        
        // Add fade in animation
        this.authMessage.style.opacity = '0';
        this.authMessage.style.transform = 'translateY(10px)';
        setTimeout(() => {
            this.authMessage.style.opacity = '1';
            this.authMessage.style.transform = 'translateY(0)';
        }, 100);
        
        setTimeout(() => {
            this.authMessage.textContent = '';
        }, 3000);
    }

    togglePasswordVisibility() {
        const passwordInput = this.passwordInput;
        const toggleButton = passwordInput.parentElement.querySelector('button[aria-label*="password"]');
        const toggleIcon = toggleButton.querySelector('svg');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            // Change to "hide" icon
            toggleIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
            `;
            toggleButton.title = 'Hide password';
            toggleButton.setAttribute('aria-label', 'Hide password');
        } else {
            passwordInput.type = 'password';
            // Change to "show" icon
            toggleIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            `;
            toggleButton.title = 'Show password';
            toggleButton.setAttribute('aria-label', 'Show password');
        }
    }

    async initializeChat() {
        this.showLoadingOverlay('Initializing audio and video...');
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: true 
            });
            this.localVideo.srcObject = this.localStream;
            
            // Disable video by default
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = false; // Turn off video by default
                this.videoBtn.classList.add('bg-red-500/80');
                this.videoBtn.innerHTML = '<span class="hidden sm:inline">Video Off</span>';
                this.localVideo.style.opacity = '0.3'; // Dim the local video to show it's off
            }
            
            // Keep video container hidden initially since video is off
            this.videoContainer.classList.add('hidden');
            this.messagesDiv.classList.remove('hidden'); // Show text chat instead
            
            this.displaySystemMessage('Camera and microphone ready (video off by default)');
        } catch (error) {
            console.error('Media access error:', error);
            this.displaySystemMessage('Camera and microphone access denied. Trying audio only...');
            
            // Fallback to audio-only if video fails
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this.displaySystemMessage('Audio-only mode enabled');
                
                // Update video button to indicate no video
                this.videoBtn.classList.add('bg-red-500/80');
                this.videoBtn.innerHTML = '<span class="hidden sm:inline">No Camera</span>';
                this.videoBtn.disabled = true;
                this.videoBtn.title = 'Camera not available';
            } catch (audioError) {
                console.error('Audio access error:', audioError);
                this.displaySystemMessage('Microphone access denied. Limited functionality available.');
                
                // Disable audio/video controls
                this.muteBtn.disabled = true;
                this.videoBtn.disabled = true;
                this.muteBtn.title = 'Microphone not available';
                this.videoBtn.title = 'Camera not available';
            }
        }
        
        this.authSection.classList.add('hidden');
        this.chatSection.classList.remove('hidden');
        this.currentUserSpan.textContent = this.currentUser;
        this.isLoggedIn = true;
        
        // Initialize user count to 1 (current user)
        this.updateUserCount(1);
        
        this.hideLoadingOverlay();
        this.showLoadingOverlay('Connecting to server...');
        this.connectWebSocket();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.displaySystemMessage('Connected to server');
            this.hideLoadingOverlay();
            
            if (this.isLoggedIn) {
                this.currentChannel = null; // Force a fresh join
                this.joinChannel('general');
            }
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.displaySystemMessage('Disconnected from server. Reconnecting...');
            this.showLoadingOverlay('Reconnecting to server...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.displaySystemMessage('Connection error occurred');
        };
    }

    handleMessage(message) {
        switch (message.type) {
            case 'message':
                this.displayMessage(message);
                break;
            case 'user_list':
                this.updateUserList(message.data);
                break;
            case 'user_joined':
                this.handleUserJoined(message.username);
                this.displaySystemMessage(`${message.username} joined the channel`);
                break;
            case 'user_left':
                this.handleUserLeft(message.username);
                this.displaySystemMessage(`${message.username} left the channel`);
                break;
            case 'video_status':
                this.handleVideoStatusUpdate(message.username, message.videoEnabled);
                break;
            case 'offer':
                this.handleOffer(message.from, message.data);
                break;
            case 'answer':
                this.handleAnswer(message.from, message.data);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(message.from, message.data);
                break;
        }
    }

    joinChannel(channelId) {
        if (this.currentChannel === channelId) {
            return;
        }
        
        // Leave current channel if exists
        if (this.currentChannel) {
            this.sendWebSocketMessage({
                type: 'leave_channel',
                username: this.currentUser,
                channel: this.currentChannel
            });
            // Close all existing peer connections
            for (const pc of this.peerConnections.values()) {
                pc.close();
            }
            this.peerConnections.clear();
        }
        
        this.currentChannel = channelId;
        this.currentChannelSpan.textContent = `# ${channelId}`;
        this.messagesDiv.innerHTML = '';
        this.usersList.innerHTML = '';
        
        this.sendWebSocketMessage({
            type: 'join_channel',
            username: this.currentUser,
            channel: channelId
        });
        
        // Broadcast initial video status after joining
        setTimeout(() => {
            if (this.localStream) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    this.broadcastVideoStatus(videoTrack.enabled);
                }
            }
        }, 500); // Small delay to ensure other users have processed the join
    }

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;
        
        this.sendWebSocketMessage({
            type: 'message',
            username: this.currentUser,
            content: content,
            channel: this.currentChannel
        });
        
        this.messageInput.value = '';
    }

    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected. State:', this.ws ? this.ws.readyState : 'null');
        }
    }

    displayMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-3 fade-in';
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const isOwnMessage = message.username === this.currentUser;
        
        // Process message content to handle URLs
        const processedContent = this.processMessageContent(message.content);
        
        if (isOwnMessage) {
            // Own messages - right aligned
            messageDiv.innerHTML = `
                <div class="flex justify-end items-end space-x-2 mb-1">
                    <div class="flex flex-col items-end max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl">
                        <div class="message-bubble message-own">
                            <div class="message-content">${processedContent}</div>
                        </div>
                        <div class="text-xs text-gray-400 mt-1 px-2">${timestamp}</div>
                    </div>
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        ${this.currentUser.charAt(0).toUpperCase()}
                    </div>
                </div>
            `;
        } else {
            // Other messages - left aligned
            messageDiv.innerHTML = `
                <div class="flex justify-start items-end space-x-2 mb-1">
                    <div class="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        ${message.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col items-start max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl">
                        <div class="text-xs text-gray-400 mb-1 px-2 font-medium">${this.escapeHtml(message.username)}</div>
                        <div class="message-bubble message-other">
                            <div class="message-content">${processedContent}</div>
                        </div>
                        <div class="text-xs text-gray-400 mt-1 px-2">${timestamp}</div>
                    </div>
                </div>
            `;
        }
        
        this.messagesDiv.appendChild(messageDiv);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    processMessageContent(content) {
        // Escape HTML first
        const escaped = this.escapeHtml(content);
        
        // URL regex to detect various URL formats
        const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
        
        // Replace URLs with clickable links
        return escaped.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="url-link break-all">${url}</a>`;
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    displaySystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-center my-4 fade-in';
        
        messageDiv.innerHTML = `
            <div class="bg-gray-700/50 backdrop-blur-sm text-gray-300 text-sm px-4 py-2 rounded-full border border-gray-600/30">
                ${this.escapeHtml(content)}
            </div>
        `;
        
        this.messagesDiv.appendChild(messageDiv);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    updateUserList(userList) {
        this.usersList.innerHTML = '';
        
        // Add current user first (visually distinct)
        if (this.currentUser) {
            const currentUserDiv = document.createElement('div');
            currentUserDiv.className = 'flex items-center space-x-2 p-2 bg-gradient-to-r from-white/10 to-gray-200/10 rounded border border-white/20 backdrop-blur-sm';
            currentUserDiv.dataset.user = this.currentUser;
            
            // Check current user's video status
            const hasVideo = this.localStream && this.localStream.getVideoTracks()[0] && this.localStream.getVideoTracks()[0].enabled;
            const videoIcon = hasVideo ? '📹' : '📷';
            const videoTitle = hasVideo ? 'Video On' : 'Video Off';
            
            currentUserDiv.innerHTML = `
                <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span class="font-semibold text-white">${this.currentUser} (You)</span>
                <span class="video-status text-xs" title="${videoTitle}">${videoIcon}</span>
            `;
            this.usersList.appendChild(currentUserDiv);
        }
        
        // Add other users
        userList.forEach(username => {
            if (username !== this.currentUser) {
                const userDiv = document.createElement('div');
                userDiv.className = 'flex items-center space-x-2 p-2 bg-gray-700 rounded';
                userDiv.dataset.user = username;
                userDiv.innerHTML = `
                    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>${username}</span>
                    <span class="video-status text-xs" title="Video Off">📷</span>
                `;
                this.usersList.appendChild(userDiv);
                // Initiate connection to existing users
                this.handleUserJoined(username);
            }
        });
        
        // Update user count to show total users
        this.updateUserCount(userList.length);
    }

    addUserToList(username) {
        if (document.querySelector(`[data-user="${username}"]`)) return;
        
        const userDiv = document.createElement('div');
        userDiv.className = 'flex items-center space-x-2 p-2 bg-gray-700 rounded';
        userDiv.dataset.user = username;
        userDiv.innerHTML = `
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>${username}</span>
            <span class="video-status text-xs" title="Video Off">📷</span>
        `;
        this.usersList.appendChild(userDiv);
        
        // Update user count
        this.updateUserCountFromList();
    }

    removeUserFromList(username) {
        const userDiv = document.querySelector(`[data-user="${username}"]`);
        if (userDiv) {
            userDiv.remove();
        }
        
        // Update user count
        this.updateUserCountFromList();
    }

    updateUserCount(count) {
        const userCountElement = document.getElementById('user-count');
        if (userCountElement) {
            userCountElement.textContent = count;
        }
    }

    updateUserCountFromList() {
        const userElements = document.querySelectorAll('[data-user]');
        this.updateUserCount(userElements.length);
    }

    createPeerConnection(username) {
        const pc = new RTCPeerConnection({
            iceServers: [
                // STUN servers for NAT traversal
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                
                // Free public TURN servers (may have limitations)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turns:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            // Additional RTCConfiguration options for better connectivity
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });

        pc.onicecandidate = event => {
            if (event.candidate) {
                this.sendWebSocketMessage({
                    type: 'ice-candidate',
                    to: username,
                    from: this.currentUser,
                    channel: this.currentChannel,
                    data: event.candidate
                });
            }
        };

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
            this.handleConnectionStateChange(username, pc.connectionState);
        };

        // ICE connection state monitoring
        pc.oniceconnectionstatechange = () => {
            this.handleIceConnectionStateChange(username, pc.iceConnectionState);
        };

        // Signaling state monitoring
        pc.onsignalingstatechange = () => {
            console.log(`Signaling state for ${username}: ${pc.signalingState}`);
        };

        // ICE gathering state monitoring
        pc.onicegatheringstatechange = () => {
            console.log(`ICE gathering state for ${username}: ${pc.iceGatheringState}`);
            if (pc.iceGatheringState === 'gathering') {
                this.displaySystemMessage(`Gathering network information for ${username}...`);
            } else if (pc.iceGatheringState === 'complete') {
                console.log(`ICE gathering complete for ${username}`);
            }
        };

        pc.ontrack = event => {
            const track = event.track;
            const stream = event.streams[0];
            
            if (track.kind === 'video') {
                // Handle video track - show in popup instead of main container
                console.log(`Received video track from ${username}`);
                this.displaySystemMessage(`${username} started sharing video`);
                
                // Store the track reference for this user
                if (!this.remoteVideoTracks) {
                    this.remoteVideoTracks = new Map();
                }
                this.remoteVideoTracks.set(username, track);
                
                // Show video in popup modal only if track is enabled
                if (track.enabled && track.readyState === 'live') {
                    this.showVideoPopup(stream, username);
                }
                
                // Monitor track state
                track.onended = () => {
                    console.log(`Remote video track ended for ${username}`);
                    this.handleRemoteTrackEnded(username, 'video');
                    // Clean up track reference
                    if (this.remoteVideoTracks) {
                        this.remoteVideoTracks.delete(username);
                    }
                    // Remove participant from video chat
                    this.removeVideoParticipant(username);
                };
                
                track.onmute = () => {
                    console.log(`Remote video track muted for ${username} (network/bandwidth issue)`);
                    // Update participant status but don't remove
                    this.updateParticipantStatus(username, 'muted');
                };
                
                track.onunmute = () => {
                    console.log(`Remote video track unmuted for ${username}`);
                    // Update participant status
                    this.updateParticipantStatus(username, 'active');
                };
            } else if (track.kind === 'audio') {
                // Handle audio track - create audio element for playback
                let remoteAudio = document.getElementById(`remote-audio-${username}`);
                if (!remoteAudio) {
                    remoteAudio = document.createElement('audio');
                    remoteAudio.id = `remote-audio-${username}`;
                    remoteAudio.autoplay = true;
                    document.body.appendChild(remoteAudio);
                }
                remoteAudio.srcObject = stream;
                
                // Monitor audio track state
                track.onended = () => {
                    console.log(`Remote audio track ended for ${username}`);
                    this.handleRemoteTrackEnded(username, 'audio');
                };
                
                track.onmute = () => {
                    console.log(`Remote audio track muted for ${username}`);
                    this.updateUserMuteStatus(username, true);
                };
                
                track.onunmute = () => {
                    console.log(`Remote audio track unmuted for ${username}`);
                    this.updateUserMuteStatus(username, false);
                };
            }
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        this.peerConnections.set(username, pc);
        return pc;
    }

    handleUserJoined(username) {
        if (username === this.currentUser || this.peerConnections.has(username)) {
            return;
        }
        
        // Add user to the visual list
        this.addUserToList(username);
        
        const pc = this.createPeerConnection(username);
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                this.sendWebSocketMessage({
                    type: 'offer',
                    to: username,
                    from: this.currentUser,
                    channel: this.currentChannel,
                    data: pc.localDescription
                });
                
                // Broadcast our current video status to the new user
                if (this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    if (videoTrack) {
                        this.broadcastVideoStatus(videoTrack.enabled);
                    }
                }
            })
            .catch(e => console.error('Error creating offer:', e));
    }

    handleUserLeft(username) {
        if (this.peerConnections.has(username)) {
            this.peerConnections.get(username).close();
            this.peerConnections.delete(username);
        }
        
        // Clean up remote video track reference
        if (this.remoteVideoTracks && this.remoteVideoTracks.has(username)) {
            this.remoteVideoTracks.delete(username);
        }
        
        // Clean up remote audio element for this user
        const remoteAudio = document.getElementById(`remote-audio-${username}`);
        if (remoteAudio) {
            remoteAudio.remove();
        }
        
        this.removeUserFromList(username);
        
        // Remove from video chat if participating
        this.removeVideoParticipant(username);
        
        // If no more peer connections, clear remote video and show messages
        if (this.peerConnections.size === 0) {
            this.remoteVideo.srcObject = null;
            // Only close popup if there are no video participants
            if (this.videoParticipants.size === 0) {
                this.videoPopupModal.classList.add('hidden');
                this.minimizedVideoIndicator.classList.add('hidden');
            }
            if (!this.videoContainer.classList.contains('hidden')) {
                this.videoContainer.classList.add('hidden');
                this.messagesDiv.classList.remove('hidden');
            }
        }
    }

    handleOffer(fromUsername, offer) {
        // Don't create connection to ourselves or duplicate connections
        if (fromUsername === this.currentUser) {
            return;
        }
        
        let pc = this.peerConnections.get(fromUsername);
        if (!pc) {
            pc = this.createPeerConnection(fromUsername);
        }
        
        // Check if we're in the correct state to receive an offer
        if (pc.signalingState === 'stable') {
            pc.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => {
                    // Process any queued ICE candidates
                    if (pc.iceCandidateQueue) {
                        pc.iceCandidateQueue.forEach(candidate => {
                            pc.addIceCandidate(new RTCIceCandidate(candidate))
                              .catch(e => console.error('Error adding queued ICE candidate:', e));
                        });
                        delete pc.iceCandidateQueue;
                    }
                    return pc.createAnswer();
                })
                .then(answer => pc.setLocalDescription(answer))
                .then(() => {
                    this.sendWebSocketMessage({
                        type: 'answer',
                        to: fromUsername,
                        from: this.currentUser,
                        channel: this.currentChannel,
                        data: pc.localDescription
                    });
                })
                .catch(e => console.error('Error handling offer:', e));
        } else {
            console.log(`Ignoring offer from ${fromUsername}, wrong signaling state: ${pc.signalingState}`);
        }
    }

    handleAnswer(fromUsername, answer) {
        const pc = this.peerConnections.get(fromUsername);
        if (pc) {
            // Check if we're in the correct state to receive an answer
            if (pc.signalingState === 'have-local-offer') {
                pc.setRemoteDescription(new RTCSessionDescription(answer))
                  .then(() => {
                      // Process any queued ICE candidates
                      if (pc.iceCandidateQueue) {
                          pc.iceCandidateQueue.forEach(candidate => {
                              pc.addIceCandidate(new RTCIceCandidate(candidate))
                                .catch(e => console.error('Error adding queued ICE candidate:', e));
                          });
                          delete pc.iceCandidateQueue;
                      }
                  })
                  .catch(e => console.error('Error handling answer:', e));
            } else {
                console.log(`Ignoring answer from ${fromUsername}, wrong signaling state: ${pc.signalingState}`);
            }
        }
    }

    handleIceCandidate(fromUsername, candidate) {
        const pc = this.peerConnections.get(fromUsername);
        if (pc) {
            // Only add ICE candidates if we have remote description set
            if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(candidate))
                  .catch(e => console.error('Error adding ICE candidate:', e));
            } else {
                console.log(`Queueing ICE candidate from ${fromUsername}, waiting for remote description`);
                // Queue the candidate for later
                if (!pc.iceCandidateQueue) {
                    pc.iceCandidateQueue = [];
                }
                pc.iceCandidateQueue.push(candidate);
            }
        }
    }

    // Connection state management methods
    handleConnectionStateChange(username, connectionState) {
        console.log(`Connection state for ${username}: ${connectionState}`);
        
        switch (connectionState) {
            case 'connecting':
                this.displaySystemMessage(`Connecting to ${username}...`);
                this.showConnectionStatus(username, 'connecting', '🔄');
                break;
            case 'connected':
                this.displaySystemMessage(`Connected to ${username}`);
                this.showConnectionStatus(username, 'connected', '✅');
                this.hideLoadingOverlay();
                
                // Reset retry attempts on successful connection
                if (this.retryAttempts) {
                    this.retryAttempts.delete(username);
                }
                break;
            case 'disconnected':
                this.displaySystemMessage(`Disconnected from ${username}`);
                this.showConnectionStatus(username, 'disconnected', 'X');
                break;
            case 'failed':
                this.displaySystemMessage(`Connection failed with ${username}`);
                this.showConnectionStatus(username, 'failed', 'X');
                this.handleConnectionFailure(username);
                break;
            case 'closed':
                this.displaySystemMessage(`Connection closed with ${username}`);
                this.removeConnectionStatus(username);
                break;
        }
    }

    handleIceConnectionStateChange(username, iceConnectionState) {
        console.log(`ICE connection state for ${username}: ${iceConnectionState}`);
        
        switch (iceConnectionState) {
            case 'checking':
                this.showLoadingOverlay(`Establishing connection with ${username}...`);
                this.displaySystemMessage(`Checking network connectivity with ${username}...`);
                break;
            case 'connected':
            case 'completed':
                this.hideLoadingOverlay();
                this.displaySystemMessage(`Successfully connected to ${username}`);
                break;
            case 'failed':
                this.hideLoadingOverlay();
                this.displaySystemMessage(`❌ Unable to establish direct connection with ${username}. This may be due to firewall or NAT restrictions.`);
                console.error(`ICE connection failed for ${username}. Consider using a TURN server for better connectivity.`);
                
                // Attempt to restart ICE
                const pc = this.peerConnections.get(username);
                if (pc && pc.connectionState !== 'closed') {
                    console.log(`Attempting ICE restart for ${username}`);
                    this.displaySystemMessage(`Attempting to reconnect to ${username} using alternative route...`);
                    pc.restartIce();
                }
                break;
            case 'disconnected':
                this.displaySystemMessage(`⚠️ Connection with ${username} interrupted, attempting to reconnect...`);
                
                // Give it some time to reconnect automatically
                setTimeout(() => {
                    const pc = this.peerConnections.get(username);
                    if (pc && pc.iceConnectionState === 'disconnected') {
                        console.log(`ICE still disconnected for ${username}, attempting restart`);
                        pc.restartIce();
                    }
                }, 5000);
                break;
            case 'closed':
                this.hideLoadingOverlay();
                this.displaySystemMessage(`Connection with ${username} closed`);
                break;
        }
    }

    handleConnectionFailure(username) {
        console.log(`Handling connection failure for ${username}`);
        
        // Track retry attempts
        if (!this.retryAttempts) {
            this.retryAttempts = new Map();
        }
        
        const currentAttempts = this.retryAttempts.get(username) || 0;
        const maxRetries = 3;
        
        if (currentAttempts < maxRetries) {
            const retryDelay = Math.min(3000 * Math.pow(2, currentAttempts), 15000); // Exponential backoff, max 15s
            this.retryAttempts.set(username, currentAttempts + 1);
            
            console.log(`Attempting to reconnect to ${username} (attempt ${currentAttempts + 1}/${maxRetries}) in ${retryDelay}ms`);
            this.displaySystemMessage(`🔄 Reconnecting to ${username}... (attempt ${currentAttempts + 1}/${maxRetries})`);
            
            setTimeout(() => {
                if (this.peerConnections.has(username)) {
                    console.log(`Retry ${currentAttempts + 1}: Reconnecting to ${username}`);
                    
                    // Close existing connection
                    const oldPc = this.peerConnections.get(username);
                    if (oldPc) {
                        oldPc.close();
                        this.peerConnections.delete(username);
                    }
                    
                    // Create new connection with fresh peer connection
                    this.handleUserJoined(username);
                }
            }, retryDelay);
        } else {
            console.log(`Max retry attempts reached for ${username}`);
            this.displaySystemMessage(`❌ Failed to connect to ${username} after ${maxRetries} attempts. Network restrictions may be preventing the connection.`);
            this.retryAttempts.delete(username);
        }
    }

    handleRemoteTrackEnded(username, trackKind) {
        if (trackKind === 'video') {
            this.displaySystemMessage(`${username} stopped sharing video`);
        } else if (trackKind === 'audio') {
            this.displaySystemMessage(`${username} disconnected audio`);
        }
    }

    showConnectionStatus(username, status, emoji) {
        const userElement = document.querySelector(`[data-user="${username}"]`);
        if (userElement) {
            const statusElement = userElement.querySelector('.connection-status') || 
                                 (() => {
                                     const el = document.createElement('span');
                                     el.className = 'connection-status ml-2 text-xs';
                                     userElement.appendChild(el);
                                     return el;
                                 })();
            
            statusElement.textContent = emoji;
            statusElement.title = `Connection: ${status}`;
            
            // Add visual feedback based on status
            userElement.className = userElement.className.replace(/connection-\w+/g, '');
            userElement.classList.add(`connection-${status}`);
        }
    }

    removeConnectionStatus(username) {
        const userElement = document.querySelector(`[data-user="${username}"]`);
        if (userElement) {
            const statusElement = userElement.querySelector('.connection-status');
            if (statusElement) {
                statusElement.remove();
            }
            userElement.className = userElement.className.replace(/connection-\w+/g, '');
        }
    }

    updateUserMuteStatus(username, isMuted) {
        const userElement = document.querySelector(`[data-user="${username}"]`);
        if (userElement) {
            const muteIndicator = userElement.querySelector('.mute-indicator') || 
                                 (() => {
                                     const el = document.createElement('span');
                                     el.className = 'mute-indicator ml-1 text-xs';
                                     userElement.appendChild(el);
                                     return el;
                                 })();
            
            if (isMuted) {
                muteIndicator.textContent = 'Muted';
                muteIndicator.title = 'Microphone muted';
                this.displaySystemMessage(`${username} muted their microphone`);
            } else {
                muteIndicator.textContent = 'Active';
                muteIndicator.title = 'Microphone active';
                this.displaySystemMessage(`${username} unmuted their microphone`);
            }
        }
    }

    updateParticipantStatus(username, status) {
        const participantPreview = document.getElementById(`participant-${username}`);
        if (participantPreview) {
            const statusIndicator = participantPreview.querySelector('.w-3');
            if (statusIndicator) {
                // Update status indicator color
                statusIndicator.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500');
                switch (status) {
                    case 'active':
                        statusIndicator.classList.add('bg-green-500');
                        break;
                    case 'muted':
                        statusIndicator.classList.add('bg-yellow-500');
                        break;
                    case 'disconnected':
                        statusIndicator.classList.add('bg-red-500');
                        break;
                }
            }
        }
    }

    handleVideoStatusUpdate(username, videoEnabled) {
        const userElement = document.querySelector(`[data-user="${username}"]`);
        if (userElement) {
            const videoStatusElement = userElement.querySelector('.video-status');
            if (videoStatusElement) {
                const videoIcon = videoEnabled ? '📹' : '📷';
                const videoTitle = videoEnabled ? 'Video On' : 'Video Off';
                
                videoStatusElement.textContent = videoIcon;
                videoStatusElement.title = videoTitle;
                
                this.displaySystemMessage(`${username} ${videoEnabled ? 'enabled' : 'disabled'} their camera`);
            }
        }

        // Handle video popup based on explicit user video status changes
        if (!videoEnabled) {
            // User explicitly disabled video - remove from video chat
            this.removeVideoParticipant(username);
            console.log(`Removed ${username} from video chat due to disabled video`);
        } else {
            // User explicitly enabled video - add to video chat if we have their video track
            const videoTrack = this.remoteVideoTracks ? this.remoteVideoTracks.get(username) : null;
            if (videoTrack && videoTrack.readyState === 'live') {
                // Create a stream with the video track and add participant
                const stream = new MediaStream([videoTrack]);
                this.showVideoPopup(stream, username);
                console.log(`Added ${username} to video chat due to enabled video`);
            }
        }
    }

    broadcastVideoStatus(videoEnabled) {
        this.sendWebSocketMessage({
            type: 'video_status',
            username: this.currentUser,
            channel: this.currentChannel,
            videoEnabled: videoEnabled
        });
    }

    updateCurrentUserVideoStatus(videoEnabled) {
        const currentUserElement = document.querySelector(`[data-user="${this.currentUser}"]`);
        if (currentUserElement) {
            const videoStatusElement = currentUserElement.querySelector('.video-status');
            if (videoStatusElement) {
                const videoIcon = videoEnabled ? '📹' : '📷';
                const videoTitle = videoEnabled ? 'Video On' : 'Video Off';
                
                videoStatusElement.textContent = videoIcon;
                videoStatusElement.title = videoTitle;
            }
        }
    }

    showLoadingOverlay(message = 'Connecting...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const messageElement = overlay.querySelector('.text-lg');
            if (messageElement) {
                messageElement.textContent = message;
            }
            overlay.classList.remove('hidden');
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    // Helper method to revert from screen sharing to camera
    async revertToCamera() {
        if (!this.localStream) {
            throw new Error('No local stream available');
        }

        const currentVideoTrack = this.localStream.getVideoTracks()[0];
        if (!currentVideoTrack) {
            throw new Error('No video track available');
        }

        try {
            // Get new camera stream
            const cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }, 
                audio: false 
            });
            const cameraTrack = cameraStream.getVideoTracks()[0];
            
            // Replace track on all peer connections
            for (const pc of this.peerConnections.values()) {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(cameraTrack);
                }
            }
            
            // Stop the old track and replace it in the stream
            currentVideoTrack.stop();
            this.localStream.removeTrack(currentVideoTrack);
            this.localStream.addTrack(cameraTrack);
            this.localVideo.srcObject = this.localStream;
            
            return true;
        } catch (error) {
            console.error('Error reverting to camera:', error);
            throw error;
        }
    }

    toggleVideo() {
        if (!this.localStream) {
            this.displaySystemMessage('No video stream available');
            return;
        }
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            const wasEnabled = videoTrack.enabled;
            videoTrack.enabled = !videoTrack.enabled;
            
            // Update button state and styling
            if (videoTrack.enabled) {
                this.videoBtn.classList.add('bg-green-500/80');
                this.videoBtn.classList.remove('bg-red-500/80');
                this.videoBtn.innerHTML = '<span class="hidden sm:inline">Video On</span>';
                this.displaySystemMessage('Camera enabled');
                
                // Show video container when video is enabled
                if (this.videoContainer.classList.contains('hidden')) {
                    this.videoContainer.classList.remove('hidden');
                    this.messagesDiv.classList.add('hidden');
                }
            } else {
                this.videoBtn.classList.remove('bg-green-500/80');
                this.videoBtn.classList.add('bg-red-500/80');
                this.videoBtn.innerHTML = '<span class="hidden sm:inline">Video Off</span>';
                this.displaySystemMessage('Camera disabled');
                
                // Hide video container when video is disabled (unless there's remote video)
                const hasRemoteVideo = this.remoteVideo.srcObject && this.remoteVideo.srcObject.getVideoTracks().length > 0;
                if (!hasRemoteVideo && !this.videoContainer.classList.contains('hidden')) {
                    this.videoContainer.classList.add('hidden');
                    this.messagesDiv.classList.remove('hidden');
                }
            }
            
            // Update current user's video status in the user list
            this.updateCurrentUserVideoStatus(videoTrack.enabled);
            
            // Broadcast video status to other users
            this.broadcastVideoStatus(videoTrack.enabled);
            
            // Log state change
            console.log(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
            
            // Update local video display
            if (this.localVideo) {
                this.localVideo.style.opacity = videoTrack.enabled ? '1' : '0.3';
            }
        } else {
            this.displaySystemMessage('No video track found');
        }
    }

    // Video Popup Management Methods
    showVideoPopup(remoteStream, remoteUsername) {
        if (!this.videoPopupModal || !remoteStream) return;

        // Verify the stream has active video tracks
        const videoTracks = remoteStream.getVideoTracks();
        if (videoTracks.length === 0 || !videoTracks[0] || videoTracks[0].readyState !== 'live') {
            console.log(`No active video tracks for ${remoteUsername}`);
            return;
        }

        console.log(`Adding video participant: ${remoteUsername}`);

        // Add participant to the video chat
        this.addVideoParticipant(remoteUsername, remoteStream);

        // If popup is hidden, show minimized indicator instead of auto-opening
        if (this.videoPopupModal.classList.contains('hidden')) {
            this.minimizedVideoIndicator.classList.remove('hidden');
            console.log('Video popup is minimized, showing indicator');
        } else {
            // Update participant count if popup is visible
            this.updateParticipantCount();
        }

        console.log(`Video participant ${remoteUsername} added`);
    }

    addVideoParticipant(username, stream) {
        // Store participant data
        this.videoParticipants.set(username, {
            stream: stream,
            videoElement: null
        });

        // If no main video user is set, make this user the main video
        if (!this.currentMainVideoUser) {
            this.setMainVideoUser(username, stream);
        }

        // Create participant preview
        this.createParticipantPreview(username, stream);

        // If this is the first participant and popup is hidden, auto-open it
        if (this.videoParticipants.size === 1 && this.videoPopupModal.classList.contains('hidden')) {
            this.openVideoPopup();
        }
    }

    createParticipantPreview(username, stream) {
        // Check if preview already exists
        const existingPreview = document.getElementById(`participant-${username}`);
        if (existingPreview) {
            existingPreview.querySelector('video').srcObject = stream;
            return;
        }

        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'flex-shrink-0 relative cursor-pointer video-participant-preview';
        previewContainer.id = `participant-${username}`;
        previewContainer.onclick = () => this.setMainVideoUser(username, stream);

        // Create video element
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = false;
        video.srcObject = stream;
        video.className = 'w-16 h-12 object-cover rounded border border-white/30 shadow-sm bg-black';

        // Create username label
        const usernameLabel = document.createElement('div');
        usernameLabel.className = 'absolute bottom-0 left-0 bg-black/70 text-white px-1 py-0.5 rounded-br text-xs leading-none';
        usernameLabel.textContent = username;

        // Create status indicator (green dot for active video)
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'absolute top-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white';

        // Assemble preview
        previewContainer.appendChild(video);
        previewContainer.appendChild(usernameLabel);
        previewContainer.appendChild(statusIndicator);

        // Add to participants container
        this.videoParticipantsContainer.appendChild(previewContainer);

        // Store video element reference
        this.videoParticipants.get(username).videoElement = video;
    }

    setMainVideoUser(username, stream) {
        this.currentMainVideoUser = username;
        
        // Update main video
        if (this.popupMainVideo && stream) {
            this.popupMainVideo.srcObject = stream;
        }

        // Update main video username label
        if (this.mainVideoUsername) {
            this.mainVideoUsername.textContent = username;
        }

        // Update preview highlights
        this.updatePreviewHighlights();

        console.log(`Main video set to: ${username}`);
    }

    updatePreviewHighlights() {
        // Remove highlight from all previews
        document.querySelectorAll('[id^="participant-"]').forEach(preview => {
            const video = preview.querySelector('video');
            if (video) {
                video.classList.remove('border-blue-500');
                video.classList.add('border-white/30');
            }
        });

        // Highlight current main video user
        if (this.currentMainVideoUser) {
            const mainPreview = document.getElementById(`participant-${this.currentMainVideoUser}`);
            if (mainPreview) {
                const video = mainPreview.querySelector('video');
                if (video) {
                    video.classList.remove('border-white/30');
                    video.classList.add('border-blue-500');
                }
            }
        }
    }

    removeVideoParticipant(username) {
        // Remove from participants map
        this.videoParticipants.delete(username);

        // Remove preview element
        const previewElement = document.getElementById(`participant-${username}`);
        if (previewElement) {
            previewElement.remove();
        }

        // If this was the main video user, switch to another participant
        if (this.currentMainVideoUser === username) {
            const remainingParticipants = Array.from(this.videoParticipants.keys());
            if (remainingParticipants.length > 0) {
                const nextUser = remainingParticipants[0];
                const nextStream = this.videoParticipants.get(nextUser).stream;
                this.setMainVideoUser(nextUser, nextStream);
            } else {
                // No more participants, close popup completely
                this.currentMainVideoUser = null;
                if (this.popupMainVideo) {
                    this.popupMainVideo.srcObject = null;
                }
                this.videoPopupModal.classList.add('hidden');
                this.minimizedVideoIndicator.classList.add('hidden');
                console.log('All video participants removed, popup closed');
                return;
            }
        }

        // Update participant count
        this.updateParticipantCount();

        console.log(`Video participant ${username} removed`);
    }

    updateParticipantCount() {
        const count = this.videoParticipants.size;
        if (this.activeParticipantsCount) {
            this.activeParticipantsCount.textContent = count;
        }
        
        // Update minimized indicator count
        const minimizedCount = document.getElementById('minimized-participant-count');
        if (minimizedCount) {
            minimizedCount.textContent = count;
        }
        
        // Update minimized indicator visibility based on participant count
        if (count > 0 && this.videoPopupModal.classList.contains('hidden')) {
            this.minimizedVideoIndicator.classList.remove('hidden');
        } else if (count === 0) {
            this.minimizedVideoIndicator.classList.add('hidden');
        }
    }

    openVideoPopup() {
        if (!this.videoPopupModal) return;

        // Set local video stream
        if (this.popupLocalVideo && this.localStream) {
            this.popupLocalVideo.srcObject = this.localStream;
        }

        // Show the popup
        this.videoPopupModal.classList.remove('hidden');
        this.minimizedVideoIndicator.classList.add('hidden');

        // Add fade-in animation
        setTimeout(() => {
            this.videoPopupModal.classList.add('animate-fadeIn');
        }, 10);

        console.log('Video popup opened');
    }

    closeVideoPopupModal() {
        if (!this.videoPopupModal) return;

        // Hide the popup
        this.videoPopupModal.classList.add('hidden');
        
        // Show minimized indicator if there are active video participants
        if (this.videoParticipants.size > 0) {
            this.minimizedVideoIndicator.classList.remove('hidden');
        } else {
            this.minimizedVideoIndicator.classList.add('hidden');
        }

        console.log('Video popup minimized/closed');
    }

    restoreVideoPopup() {
        if (!this.videoPopupModal) return;
        
        // Only restore if there are active video participants
        if (this.videoParticipants.size === 0) {
            this.minimizedVideoIndicator.classList.add('hidden');
            return;
        }

        // Show the popup
        this.videoPopupModal.classList.remove('hidden');
        this.minimizedVideoIndicator.classList.add('hidden');

        // Restore local video stream
        if (this.popupLocalVideo && this.localStream) {
            this.popupLocalVideo.srcObject = this.localStream;
        }

        // Restore main video if we have a current main user
        if (this.currentMainVideoUser && this.videoParticipants.has(this.currentMainVideoUser)) {
            const participantData = this.videoParticipants.get(this.currentMainVideoUser);
            if (this.popupMainVideo && participantData.stream) {
                this.popupMainVideo.srcObject = participantData.stream;
            }
        }

        // Update participant count
        this.updateParticipantCount();

        console.log('Video popup restored');
    }

    minimizeVideoPopup() {
        if (!this.videoPopupModal) return;

        // Hide the popup but keep the minimized indicator
        this.videoPopupModal.classList.add('hidden');
        this.minimizedVideoIndicator.classList.remove('hidden');

        console.log('Video popup minimized');
    }

    // Check if there are any active video streams to show popup
    checkAndShowVideoPopup() {
        // Find the first peer connection with a video stream
        for (const [username, pc] of this.peerConnections) {
            const receivers = pc.getReceivers();
            const videoReceiver = receivers.find(receiver => receiver.track && receiver.track.kind === 'video');
            
            if (videoReceiver && videoReceiver.track && videoReceiver.track.readyState === 'live') {
                const stream = new MediaStream([videoReceiver.track]);
                this.showVideoPopup(stream, username);
                return true;
            }
        }
        return false;
    }

    // Setup drag functionality for video popup
    setupVideoPopupDrag() {
        if (!this.videoPopupModal) return;

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        // Get the header element for dragging
        const getHeader = () => this.videoPopupModal.querySelector('.flex.items-center.justify-between.p-3.border-b');

        const onMouseDown = (e) => {
            const header = getHeader();
            if (!header || !header.contains(e.target)) return;
            
            // Don't drag if clicking on buttons
            if (e.target.closest('button')) return;

            isDragging = true;
            this.videoPopupModal.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = this.videoPopupModal.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            // Keep popup within viewport bounds
            const rect = this.videoPopupModal.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            this.videoPopupModal.style.left = newLeft + 'px';
            this.videoPopupModal.style.top = newTop + 'px';
            this.videoPopupModal.style.right = 'auto';
            this.videoPopupModal.style.bottom = 'auto';
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            
            isDragging = false;
            this.videoPopupModal.classList.remove('dragging');
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.videoPopupModal.addEventListener('mousedown', onMouseDown);
    }

    async toggleScreenShare() {
        if (!this.localStream) {
            this.displaySystemMessage('No local stream available for screen sharing');
            return;
        }

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) {
            this.displaySystemMessage('No video track available for screen sharing');
            return;
        }

        if (this.isScreenSharing) {
            // Stop screen sharing and revert to camera
            this.displaySystemMessage('Stopping screen share...');
            try {
                const cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 }
                    }, 
                    audio: false 
                });
                const cameraTrack = cameraStream.getVideoTracks()[0];
                
                // Replace track on all peer connections
                for (const pc of this.peerConnections.values()) {
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(cameraTrack);
                    }
                }
                
                // Stop the old track and replace it in the stream
                videoTrack.stop();
                this.localStream.removeTrack(videoTrack);
                this.localStream.addTrack(cameraTrack);
                this.localVideo.srcObject = this.localStream;
                
                this.isScreenSharing = false;
                this.screenShareBtn.classList.remove('bg-green-500/80');
                this.screenShareBtn.innerHTML = '<span class="hidden sm:inline">Share</span>';
                this.displaySystemMessage('Switched back to camera');
                
                // Notify other users
                this.sendMessage('Stopped screen sharing', 'system');
            } catch (error) {
                console.error('Error reverting to camera:', error);
                this.displaySystemMessage('Failed to switch back to camera: ' + error.message);
            }
        } else {
            // Start screen sharing
            this.displaySystemMessage('Starting screen share...');
            try {
                // Request display media with enhanced options
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: {
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });
                
                const screenTrack = screenStream.getVideoTracks()[0];
                const screenAudioTrack = screenStream.getAudioTracks()[0];

                // Replace video track on all peer connections
                for (const pc of this.peerConnections.values()) {
                    const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        await videoSender.replaceTrack(screenTrack);
                    }
                    
                    // Add screen audio if available
                    if (screenAudioTrack) {
                        pc.addTrack(screenAudioTrack, screenStream);
                    }
                }

                // Stop the old track and replace it in the stream
                videoTrack.stop();
                this.localStream.removeTrack(videoTrack);
                this.localStream.addTrack(screenTrack);
                
                // Add screen audio to local stream if available
                if (screenAudioTrack) {
                    this.localStream.addTrack(screenAudioTrack);
                }
                
                this.localVideo.srcObject = this.localStream;
                
                this.isScreenSharing = true;
                this.screenShareBtn.classList.add('bg-green-500/80');
                this.screenShareBtn.innerHTML = '<span class="text-sm">🛑</span><span class="hidden sm:inline">Stop</span>';
                this.displaySystemMessage('Screen sharing started successfully');
                
                // Notify other users
                this.sendMessage('Started screen sharing', 'system');

                // Enhanced onended handler
                screenTrack.onended = () => {
                    console.log('Screen sharing ended by user via browser controls');
                    this.displaySystemMessage('Screen sharing ended by user');
                    
                    // Only auto-revert if still in screen sharing mode
                    if (this.isScreenSharing) {
                        // Update UI immediately
                        this.isScreenSharing = false;
                        this.screenShareBtn.classList.remove('bg-green-500/80');
                        this.screenShareBtn.innerHTML = '<span class="hidden sm:inline">Share</span>';
                        
                        // Attempt to revert to camera
                        this.revertToCamera()
                            .then(() => {
                                this.displaySystemMessage('Switched back to camera');
                                this.sendMessage('Stopped screen sharing', 'system');
                            })
                            .catch(error => {
                                console.error('Error reverting to camera after screen share ended:', error);
                                this.displaySystemMessage('Screen sharing ended, but camera may not be available');
                            });
                    }
                };

                // Additional event listeners for better error handling
                screenTrack.onmute = () => {
                    console.log('Screen track muted');
                    this.displaySystemMessage('Screen sharing paused');
                };

                screenTrack.onunmute = () => {
                    console.log('Screen track unmuted');
                    this.displaySystemMessage('Screen sharing resumed');
                };

                // Monitor screen share status
                const checkScreenShare = setInterval(() => {
                    if (screenTrack.readyState === 'ended') {
                        clearInterval(checkScreenShare);
                        if (this.isScreenSharing) {
                            this.displaySystemMessage('Screen share ended unexpectedly');
                            this.toggleScreenShare();
                        }
                    }
                }, 1000);

            } catch (error) {
                console.error('Error starting screen share:', error);
                let errorMessage = 'Failed to start screen sharing';
                
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Screen sharing permission denied by user';
                } else if (error.name === 'NotSupportedError') {
                    errorMessage = 'Screen sharing not supported by this browser';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No screen available for sharing';
                } else if (error.name === 'AbortError') {
                    errorMessage = 'Screen sharing cancelled by user';
                }
                
                this.displaySystemMessage(errorMessage);
            }
        }
    }

    toggleMute() {
        if (!this.localStream) {
            this.displaySystemMessage('No audio stream available');
            return;
        }
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            const wasEnabled = audioTrack.enabled;
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            
            // Play sound effect and update UI
            if (this.isMuted) {
                this.playSound('mute');
                this.muteBtn.innerHTML = '<span class="hidden sm:inline">Unmute</span>';
                this.muteBtn.classList.add('bg-red-500/80');
                this.muteBtn.classList.remove('bg-green-500/80');
                this.displaySystemMessage('Microphone muted');
            } else {
                this.playSound('unmute');
                this.muteBtn.innerHTML = '<span class="hidden sm:inline">Mute</span>';
                this.muteBtn.classList.add('bg-green-500/80');
                this.muteBtn.classList.remove('bg-red-500/80');
                this.displaySystemMessage('Microphone unmuted');
            }
            
            console.log(`Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
        } else {
            this.displaySystemMessage('No audio track found');
        }
    }

    // Mobile sidebar methods
    openMobileSidebar() {
        if (this.sidebar && this.mobileOverlay) {
            this.sidebar.classList.add('open');
            this.mobileOverlay.classList.add('open');
            document.body.style.overflow = 'hidden'; // Prevent body scrolling
        }
    }

    closeMobileSidebar() {
        if (this.sidebar && this.mobileOverlay) {
            this.sidebar.classList.remove('open');
            this.mobileOverlay.classList.remove('open');
            document.body.style.overflow = ''; // Restore body scrolling
        }
    }

    disconnect() {
        // Play disconnect sound before disconnecting
        this.playSound('disconnect');
        
        if (this.ws) {
            this.ws.close();
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        for (const pc of this.peerConnections.values()) {
            pc.close();
        }
        this.peerConnections.clear();
        
        // Clean up all remote audio elements
        const remoteAudioElements = document.querySelectorAll('[id^="remote-audio-"]');
        remoteAudioElements.forEach(audio => audio.remove());
        
        // Clear remote video and hide video container
        this.remoteVideo.srcObject = null;
        this.videoContainer.classList.add('hidden');
        this.messagesDiv.classList.remove('hidden');
        
        this.authSection.classList.remove('hidden');
        this.chatSection.classList.add('hidden');
        this.isLoggedIn = false;
        this.currentUser = null;
        
        // Clear session and JWT token from localStorage
        this.clearStoredSession();
        
        this.usernameInput.value = '';
        this.passwordInput.value = '';
        this.authMessage.textContent = '';
    }

    async checkExistingSession() {
        const storedToken = localStorage.getItem('jwtToken');
        const storedUsername = localStorage.getItem('username');
        
        if (!storedToken || !storedUsername) {
            // No stored session, show login form
            return;
        }

        // Check if token is expired (client-side check)
        if (this.isTokenExpired()) {
            console.log('Token expired, clearing session');
            this.clearStoredSession();
            return;
        }

        try {
            const response = await fetch('/verify-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: storedToken })
            });

            const data = await response.json();
            
            if (response.ok && data.valid) {
                // Token is valid, log user in automatically
                this.currentUser = data.user.username;
                this.isLoggedIn = true;
                await this.initializeChat();
            } else {
                // Token is invalid or expired, clear localStorage
                this.clearStoredSession();
            }
        } catch (error) {
            console.error('Error verifying session:', error);
            // On error, clear localStorage to be safe
            this.clearStoredSession();
        }
    }

    clearStoredSession() {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('username');
    }

    getAuthHeaders() {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            return {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    // Function to check if token is expired (client-side check)
    isTokenExpired() {
        const token = localStorage.getItem('jwtToken');
        if (!token) return true;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            return payload.exp < currentTime;
        } catch (error) {
            console.error('Error parsing token:', error);
            return true;
        }
    }

    // Screen sharing utility methods
    isScreenSharingSupported() {
        return navigator.mediaDevices && 
               typeof navigator.mediaDevices.getDisplayMedia === 'function';
    }

    async getScreenSharingCapabilities() {
        if (!this.isScreenSharingSupported()) {
            return null;
        }

        try {
            // Get supported constraints for display media
            const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
            const displayCapabilities = {
                video: {
                    supported: true,
                    constraints: {}
                },
                audio: {
                    supported: false,
                    constraints: {}
                }
            };

            // Check video constraints
            if (supportedConstraints.width) displayCapabilities.video.constraints.width = true;
            if (supportedConstraints.height) displayCapabilities.video.constraints.height = true;
            if (supportedConstraints.frameRate) displayCapabilities.video.constraints.frameRate = true;

            // Check audio constraints (some browsers support system audio capture)
            if (supportedConstraints.echoCancellation) {
                displayCapabilities.audio.supported = true;
                displayCapabilities.audio.constraints.echoCancellation = true;
            }
            if (supportedConstraints.noiseSuppression) {
                displayCapabilities.audio.supported = true;
                displayCapabilities.audio.constraints.noiseSuppression = true;
            }

            return displayCapabilities;
        } catch (error) {
            console.error('Error getting screen sharing capabilities:', error);
            return null;
        }
    }

    async checkScreenSharingPermission() {
        if (!this.isScreenSharingSupported()) {
            return 'not-supported';
        }

        try {
            // Try to request display media briefly to check permissions
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { width: 1, height: 1 } 
            });
            
            // Immediately stop the test stream
            stream.getTracks().forEach(track => track.stop());
            
            return 'granted';
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                return 'denied';
            } else if (error.name === 'AbortError') {
                return 'cancelled';
            } else {
                return 'unknown';
            }
        }
    }

    // Enhanced method to handle screen share with better UX
    async startScreenShareWithFeedback() {
        // Check support first
        if (!this.isScreenSharingSupported()) {
            this.displaySystemMessage('Screen sharing is not supported in this browser');
            return false;
        }

        // Show loading state
        const originalContent = this.screenShareBtn.innerHTML;
        this.screenShareBtn.innerHTML = '<span class="text-sm animate-spin">Loading...</span><span class="hidden sm:inline">Loading...</span>';
        this.screenShareBtn.disabled = true;

        try {
            // Get capabilities
            const capabilities = await this.getScreenSharingCapabilities();
            console.log('Screen sharing capabilities:', capabilities);

            // Start screen sharing
            await this.toggleScreenShare();
            return true;
        } catch (error) {
            console.error('Screen sharing failed:', error);
            this.displaySystemMessage('Failed to start screen sharing: ' + error.message);
            return false;
        } finally {
            // Restore button state
            this.screenShareBtn.innerHTML = originalContent;
            this.screenShareBtn.disabled = false;
        }
    }
}

const app = new WebRTCChat();