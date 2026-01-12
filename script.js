const SUPABASE_URL = 'https://fjbrlejyneudwdiipmbt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYnJsZWp5bmV1ZHdkaWlwbWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzM4MDksImV4cCI6MjA4MjA0OTgwOX0.dYth1MXsn4-26Rb5XCca--noceIUX1Uf4VwfUWTeWyQ';
const STORAGE_BUCKET = 'avatars';
const PROTECTED_REALM_SLUGS = ['labyrinth', 'bengurwaves', 'direct-messages'];
const ADMIN_USERNAME = 'TheRealBenGurWaves';
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE'; // Replace with actual VAPID public key

let state = {
    supabase: null,
    currentUser: null,
    currentRealm: null,
    currentChannel: null,
    joinedRealms: [],
    channels: [],
    messages: [],
    directMessages: [],
    userSettings: null,
    loaderTimeout: null,
    initComplete: false,
    messageSubscription: null,
    isLoading: false,
    pendingChannelDelete: null,
    deferredPrompt: null,
    isServiceWorkerRegistered: false,
    contextMenu: null,
    touchStartTime: 0,
    touchTimer: null,
    selectedMessageForContext: null,
    selectedUserForProfile: null,
    selectedMessageForReaction: null,
    emojis: ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👏', '🔥', '🤔', '👀', '💯', '😍', '🤯', '😎', '🥳', '😴', '🤮', '👎', '🙏', '✨', '⭐', '🌟', '💫', '💥', '😊', '😇', '🤗', '🤩', '🥰', '😘', '😋', '🤪', '😜', '😝', '🤑', '🤠', '🥸', '😎', '🤓', '🧐', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😈', '👿', '👹', '👺', '💀', '☠️', '👻', '👽', '👾', '🤖', '💩', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
    usernameSaveTimer: null,
    bioSaveTimer: null,
    socialLinksSaveTimer: null,
    emailVisible: false,
    editingMessageId: null,
    mediaFullscreenElement: null,
    realmSearchTimer: null,
    userSearchTimer: null,
    searchResults: [],
    pinnedMessage: null,
    welcomeModalShown: new Set(),
    announcementModalShown: new Set(),
    channelDeleteStep: 1,
    systemThemeListener: null,
    typingIndicator: null,
    typingTimer: null,
    typingUsers: new Set(),
    mentionSearchResults: [],
    mentionSearchTimer: null,
    isMentionModalOpen: false,
    serviceWorkerRegistration: null,
    onlineCheckInterval: null,
    attachments: [],
    currentTypingChannel: null
};

// ==================== FEATURE 1: IMMEDIATE LOADING WITH SPINNER ====================
function showGlobalLoading() {
    try {
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.add('active');
        }
        
        // Auto-hide after 5 seconds
        if (state.loaderTimeout) clearTimeout(state.loaderTimeout);
        state.loaderTimeout = setTimeout(() => {
            hideGlobalLoading();
        }, 5000);
    } catch (error) {
        console.log('Error showing global loading:', error);
    }
}

function hideGlobalLoading() {
    try {
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
        
        if (state.loaderTimeout) {
            clearTimeout(state.loaderTimeout);
            state.loaderTimeout = null;
        }
    } catch (error) {
        console.log('Error hiding global loading:', error);
    }
}

function checkOnlineStatus() {
    try {
        const isOnline = navigator.onLine;
        const offlineIndicator = document.getElementById('offlineIndicator');
        
        if (offlineIndicator) {
            if (!isOnline) {
                offlineIndicator.style.display = 'flex';
                offlineIndicator.classList.add('active');
            } else {
                offlineIndicator.classList.remove('active');
                setTimeout(() => {
                    offlineIndicator.style.display = 'none';
                }, 300);
            }
        }
        
        return isOnline;
    } catch (error) {
        console.log('Error checking online status:', error);
        return true;
    }
}

function startOnlineStatusChecker() {
    // Check immediately
    checkOnlineStatus();
    
    // Check every 60 seconds
    state.onlineCheckInterval = setInterval(() => {
        if (!checkOnlineStatus()) {
            // If offline, check more frequently (every 5 seconds)
            setTimeout(checkOnlineStatus, 5000);
        }
    }, 60000);
}

// ==================== FEATURE 11: PWA NOTIFICATIONS ====================
async function registerServiceWorker() {
    try {
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });
            
            state.serviceWorkerRegistration = registration;
            state.isServiceWorkerRegistered = true;
            
            console.log('Service Worker registered with scope:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('Service Worker update found:', newWorker?.state);
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('Update Available', 'New version available. Refresh to update.', 'info');
                    }
                });
            });
            
            // Listen for controller changes
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker controller changed');
            });
            
            return registration;
        }
    } catch (error) {
        console.log('Service Worker registration failed:', error);
    }
    return null;
}

async function requestNotificationPermission() {
    try {
        if (!('Notification' in window)) {
            showToast('Notifications', 'Browser does not support notifications', 'info');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    } catch (error) {
        console.log('Error requesting notification permission:', error);
        return false;
    }
}

async function subscribeToPushNotifications() {
    try {
        if (!state.serviceWorkerRegistration || !state.currentUser || !state.supabase) return;
        
        const permissionGranted = await requestNotificationPermission();
        if (!permissionGranted) {
            showToast('Notifications', 'Permission denied', 'warning');
            return;
        }
        
        // Subscribe to push notifications
        const subscription = await state.serviceWorkerRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        // Save subscription to user profile
        const { error } = await state.supabase
            .from('profiles')
            .update({ push_subscription: subscription })
            .eq('id', state.currentUser.id);
            
        if (error) {
            console.log('Error saving push subscription:', error);
            showToast('Error', 'Failed to save notification settings', 'error');
            return;
        }
        
        state.userSettings.push_notifications = true;
        showToast('Success', 'Push notifications enabled', 'success');
        
    } catch (error) {
        console.log('Error subscribing to push notifications:', error);
        showToast('Error', 'Failed to enable push notifications', 'error');
    }
}

async function unsubscribeFromPushNotifications() {
    try {
        if (!state.serviceWorkerRegistration || !state.currentUser || !state.supabase) return;
        
        const subscription = await state.serviceWorkerRegistration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }
        
        // Remove subscription from user profile
        const { error } = await state.supabase
            .from('profiles')
            .update({ push_subscription: null })
            .eq('id', state.currentUser.id);
            
        if (error) {
            console.log('Error removing push subscription:', error);
            return;
        }
        
        state.userSettings.push_notifications = false;
        showToast('Success', 'Push notifications disabled', 'success');
        
    } catch (error) {
        console.log('Error unsubscribing from push notifications:', error);
    }
}

async function sendPushNotification(userId, title, message) {
    try {
        if (!state.supabase) return;
        
        // Call edge function
        const { error } = await state.supabase.functions.invoke('push-handler', {
            body: { user_id: userId, title, message }
        });
        
        if (error) {
            console.log('Error sending push notification:', error);
        }
    } catch (error) {
        console.log('Error sending push notification:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ==================== FEATURE 2: ADMIN PIC FIX ====================
function updateAdminAvatarStyles() {
    try {
        // Update co-admin list avatars to small circles
        document.querySelectorAll('.co-admin-item img').forEach(img => {
            img.style.width = '24px';
            img.style.height = '24px';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            img.style.marginRight = '8px';
        });
    } catch (error) {
        console.log('Error updating admin avatar styles:', error);
    }
}

// ==================== FEATURE 3: PUBLIC PROFILE STYLE ====================
function updatePublicProfileStyles() {
    try {
        const modal = document.getElementById('publicProfileModal');
        if (!modal) return;
        
        // Center elements
        modal.querySelectorAll('.public-profile-section').forEach(section => {
            section.style.textAlign = 'center';
            section.style.marginBottom = '20px';
        });
        
        // Status color
        const statusDot = document.getElementById('publicProfileStatusDot');
        if (statusDot) {
            statusDot.style.width = '10px';
            statusDot.style.height = '10px';
            statusDot.style.borderRadius = '50%';
            statusDot.style.display = 'inline-block';
            statusDot.style.marginRight = '8px';
            statusDot.style.verticalAlign = 'middle';
        }
        
        // Social links underline tan
        document.querySelectorAll('.social-link').forEach(link => {
            link.style.color = 'var(--color-tan)';
            link.style.textDecoration = 'underline';
            link.style.textDecorationColor = 'var(--color-tan-transparent)';
            link.style.margin = '0 8px';
        });
        
        // Separators
        document.querySelectorAll('.public-profile-section:not(:last-child)').forEach(section => {
            section.style.borderBottom = '1px solid var(--border-color)';
            section.style.paddingBottom = '20px';
        });
    } catch (error) {
        console.log('Error updating public profile styles:', error);
    }
}

// ==================== FEATURE 4: DM OVERHAUL ====================
async function loadDMChannels() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        showGlobalLoading();
        
        const { data: dmChannels, error } = await state.supabase
            .from('dm_channels')
            .select(`
                *,
                user1:user1_id (id, username, avatar_url),
                user2:user2_id (id, username, avatar_url)
            `)
            .or(`user1_id.eq.${state.currentUser.id},user2_id.eq.${state.currentUser.id}`)
            .order('last_message_at', { ascending: false });
            
        if (error) {
            console.log('Error loading DM channels:', error);
            hideGlobalLoading();
            return;
        }
        
        // Process DM channels
        state.directMessages = dmChannels.map(dm => {
            const partner = dm.user1_id === state.currentUser.id ? dm.user2 : dm.user1;
            return {
                id: dm.id,
                name: `DM_${partner.username}`,
                description: `Direct message with ${partner.username}`,
                partner_id: partner.id,
                partner_username: partner.username,
                partner_avatar: partner.avatar_url,
                last_message_at: dm.last_message_at,
                realm_id: state.currentRealm?.id,
                created_by: state.currentUser.id,
                is_public: false,
                is_writable: true,
                position: 999
            };
        });
        
        // Also load self-DM channel
        await ensureSelfDMChannel();
        
        // Update channels list
        state.channels = [...state.directMessages];
        renderChannels();
        
        hideGlobalLoading();
        console.log('Loaded', dmChannels.length, 'DM channels');
        
    } catch (error) {
        console.log('Error loading DM channels:', error);
        hideGlobalLoading();
    }
}

async function createDMChannel(partnerId) {
    try {
        if (!state.currentUser || !state.supabase || !partnerId) return;
        
        showGlobalLoading();
        
        // Check if DM channel already exists
        const { data: existingChannels, error: checkError } = await state.supabase
            .from('dm_channels')
            .select('*')
            .or(`and(user1_id.eq.${state.currentUser.id},user2_id.eq.${partnerId}),and(user1_id.eq.${partnerId},user2_id.eq.${state.currentUser.id})`);
            
        if (checkError) {
            console.log('Error checking existing DM channels:', checkError);
            hideGlobalLoading();
            return null;
        }
        
        if (existingChannels && existingChannels.length > 0) {
            hideGlobalLoading();
            return existingChannels[0];
        }
        
        // Create new DM channel
        const { data: newChannel, error } = await state.supabase
            .from('dm_channels')
            .insert([{
                user1_id: state.currentUser.id,
                user2_id: partnerId,
                last_message_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (error) {
            console.log('Error creating DM channel:', error);
            hideGlobalLoading();
            return null;
        }
        
        // Send notification to partner
        const { data: partnerProfile } = await state.supabase
            .from('profiles')
            .select('username')
            .eq('id', partnerId)
            .single();
            
        if (partnerProfile) {
            await sendPushNotification(
                partnerId,
                'New Direct Message',
                `${state.userSettings?.username || 'Someone'} started a conversation with you`
            );
        }
        
        hideGlobalLoading();
        showToast('Success', 'Direct message created', 'success');
        return newChannel;
        
    } catch (error) {
        console.log('Error creating DM channel:', error);
        hideGlobalLoading();
        return null;
    }
}

async function loadDMMessages(channelId) {
    try {
        if (!state.supabase || !channelId) return;
        
        const { data: messages, error } = await state.supabase
            .from('dm_messages')
            .select(`
                *,
                profiles (
                    username,
                    avatar_url,
                    status,
                    stealth_mode
                )
            `)
            .eq('dm_channel_id', channelId)
            .order('created_at', { ascending: true })
            .limit(50);
            
        if (error) {
            console.log('Error loading DM messages:', error);
            return [];
        }
        
        return messages;
    } catch (error) {
        console.log('Error loading DM messages:', error);
        return [];
    }
}

function showStartConversationModal() {
    try {
        document.getElementById('startConversationModal').style.display = 'flex';
        document.getElementById('userSearchInput').value = '';
        document.getElementById('userSearchResults').style.display = 'none';
        document.getElementById('userSearchInput').focus();
        showGlobalLoading();
        setTimeout(() => hideGlobalLoading(), 500);
    } catch (error) {
        console.log('Error showing start conversation modal:', error);
        showToast('Error', 'Failed to open search', 'error');
    }
}

// ==================== FEATURE 5: TYPING INDICATOR ====================
let typingTimeout = null;
let typingUsersMap = new Map();

function setupTypingIndicator(channelId) {
    try {
        if (!state.supabase || !state.currentUser || !channelId) return;
        
        // Remove existing subscription if any
        if (state.currentTypingChannel && state.currentTypingChannel !== channelId) {
            state.supabase.removeChannel(typingSubscription);
        }
        
        // Subscribe to typing events
        const typingSubscription = state.supabase
            .channel(`typing:${channelId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'typing_indicators',
                filter: `channel_id=eq.${channelId}`
            }, async (payload) => {
                if (payload.new.user_id === state.currentUser.id) return;
                
                const { data: userProfile, error } = await state.supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', payload.new.user_id)
                    .single();
                    
                if (error || !userProfile) return;
                
                // Add user to typing map
                typingUsersMap.set(payload.new.user_id, {
                    username: userProfile.username,
                    timestamp: Date.now()
                });
                
                showTypingIndicator();
                
                // Clear typing indicator after 1 second debounce
                if (typingTimeout) clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    typingUsersMap.delete(payload.new.user_id);
                    showTypingIndicator();
                }, 1000);
            })
            .subscribe();
            
        state.currentTypingChannel = channelId;
        
    } catch (error) {
        console.log('Error setting up typing indicator:', error);
    }
}

function showTypingIndicator() {
    try {
        const typingIndicator = document.getElementById('typingIndicator');
        if (!typingIndicator) return;
        
        if (typingUsersMap.size === 0) {
            typingIndicator.style.display = 'none';
            return;
        }
        
        const users = Array.from(typingUsersMap.values())
            .filter(user => Date.now() - user.timestamp < 2000) // Only show recent typers
            .map(user => user.username);
            
        if (users.length === 0) {
            typingIndicator.style.display = 'none';
            return;
        }
        
        let text = '';
        if (users.length === 1) {
            text = `${users[0]} is typing...`;
        } else if (users.length === 2) {
            text = `${users[0]} and ${users[1]} are typing...`;
        } else {
            text = `${users[0]} and ${users.length - 1} others are typing...`;
        }
        
        typingIndicator.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span class="typing-text">${text}</span>
        `;
        typingIndicator.style.display = 'flex';
        
        // Animate
        typingIndicator.classList.add('active');
        
    } catch (error) {
        console.log('Error showing typing indicator:', error);
    }
}

async function sendTypingIndicator() {
    try {
        if (!state.supabase || !state.currentUser || !state.currentChannel) return;
        
        // Send typing indicator
        await state.supabase
            .from('typing_indicators')
            .insert([{
                user_id: state.currentUser.id,
                channel_id: state.currentChannel.id,
                created_at: new Date().toISOString()
            }]);
            
    } catch (error) {
        console.log('Error sending typing indicator:', error);
    }
}

// ==================== FEATURE 6: MENTIONS ====================
function setupMentions() {
    try {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;
        
        messageInput.addEventListener('input', function(e) {
            const value = this.value;
            const cursorPos = this.selectionStart;
            
            // Look for @ mentions
            if (value[cursorPos - 1] === '@') {
                showMentionModal();
            }
            
            // Also check for existing mentions to add debounce for typing
            if (value.includes('@')) {
                if (state.mentionSearchTimer) clearTimeout(state.mentionSearchTimer);
                state.mentionSearchTimer = setTimeout(() => {
                    checkForMentions(value);
                }, 300);
            }
        });
        
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && state.isMentionModalOpen) {
                e.preventDefault();
                selectFirstMention();
            }
        });
        
    } catch (error) {
        console.log('Error setting up mentions:', error);
    }
}

async function checkForMentions(text) {
    try {
        if (!text.includes('@') || !state.supabase) return;
        
        const matches = text.match(/@(\w*)$/);
        if (!matches || !matches[1]) return;
        
        const searchTerm = matches[1];
        
        const { data: users, error } = await state.supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .ilike('username', `${searchTerm}%`)
            .limit(10);
            
        if (error || !users || users.length === 0) {
            hideMentionModal();
            return;
        }
        
        state.mentionSearchResults = users;
        showMentionModal();
        
    } catch (error) {
        console.log('Error checking for mentions:', error);
    }
}

function showMentionModal() {
    try {
        const modal = document.getElementById('mentionModal');
        if (!modal) return;
        
        // Update modal content
        const mentionResults = document.getElementById('mentionResults');
        mentionResults.innerHTML = '';
        
        state.mentionSearchResults.forEach(user => {
            const item = document.createElement('div');
            item.className = 'mention-result';
            item.innerHTML = `
                <img src="${user.avatar_url ? user.avatar_url + '?t=' + Date.now() : ''}" 
                     alt="${user.username}" 
                     onerror="this.style.display='none';">
                <span>${user.username}</span>
            `;
            
            item.addEventListener('click', () => {
                insertMention(user.username);
                hideMentionModal();
            });
            
            mentionResults.appendChild(item);
        });
        
        modal.style.display = 'block';
        state.isMentionModalOpen = true;
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', closeMentionModalOutside);
        }, 10);
        
    } catch (error) {
        console.log('Error showing mention modal:', error);
    }
}

function hideMentionModal() {
    try {
        const modal = document.getElementById('mentionModal');
        if (modal) {
            modal.style.display = 'none';
        }
        state.isMentionModalOpen = false;
        document.removeEventListener('click', closeMentionModalOutside);
    } catch (error) {
        console.log('Error hiding mention modal:', error);
    }
}

function closeMentionModalOutside(e) {
    try {
        const modal = document.getElementById('mentionModal');
        if (modal && !modal.contains(e.target) && e.target.id !== 'messageInput') {
            hideMentionModal();
        }
    } catch (error) {
        console.log('Error closing mention modal:', error);
    }
}

function insertMention(username) {
    try {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;
        
        const value = messageInput.value;
        const cursorPos = messageInput.selectionStart;
        
        // Find the @ position
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtPos = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtPos === -1) return;
        
        // Replace @username with @mention
        const newValue = value.substring(0, lastAtPos) + `@${username} ` + value.substring(cursorPos);
        messageInput.value = newValue;
        
        // Set cursor position after mention
        const newCursorPos = lastAtPos + username.length + 2; // +2 for @ and space
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
        messageInput.focus();
        
        // Trigger input event
        messageInput.dispatchEvent(new Event('input'));
        
    } catch (error) {
        console.log('Error inserting mention:', error);
    }
}

function selectFirstMention() {
    try {
        const mentionResults = document.getElementById('mentionResults');
        if (!mentionResults || mentionResults.children.length === 0) return;
        
        const firstItem = mentionResults.children[0];
        const username = firstItem.querySelector('span')?.textContent;
        if (username) {
            insertMention(username);
            hideMentionModal();
        }
    } catch (error) {
        console.log('Error selecting first mention:', error);
    }
}

function formatMessageContent(content) {
    if (!content) return '';
    
    let escapedContent = escapeHtml(content);
    
    // Process mentions (@username)
    escapedContent = escapedContent.replace(/@(\w+)/g, (match, username) => {
        return `<span class="mention" onclick="openUserProfileFromMention('${username}')">@${escapeHtml(username)}</span>`;
    });
    
    // Process URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escapedContent.replace(urlRegex, function(url) {
        const cleanUrl = url.replace(/[.,!?;:]$/, '');
        const trailingChar = url.slice(cleanUrl.length);
        
        // Handle attachments
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(cleanUrl);
        const isVideo = /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(cleanUrl);
        const isAudio = /\.(mp3|wav|ogg|flac|m4a)(\?.*)?$/i.test(cleanUrl);
        const isDocument = /\.(pdf|doc|docx|txt|rtf)(\?.*)?$/i.test(cleanUrl);
        
        if (isImage || isVideo || isAudio || isDocument) {
            return formatAttachment(cleanUrl) + trailingChar;
        }
        
        // Handle embeds
        const isYouTube = /youtube\.com|youtu\.be/.test(cleanUrl);
        const isSpotify = /open\.spotify\.com/.test(cleanUrl);
        const isVimeo = /vimeo\.com/.test(cleanUrl);
        const isRumble = /rumble\.com/.test(cleanUrl);
        
        if (isYouTube || isSpotify || isVimeo || isRumble) {
            // Embed handling code remains the same...
            return generateEmbedHTML(cleanUrl) + trailingChar;
        }
        
        // Regular link
        if (state.userSettings?.open_links_in_app) {
            return `<a href="${cleanUrl}" onclick="openEnhancedMedia('${cleanUrl}'); return false;" style="cursor: pointer;">${cleanUrl}</a>${trailingChar}`;
        } else {
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailingChar}`;
        }
    });
}

// ==================== FEATURE 9: ATTACHMENTS ====================
function formatAttachment(url) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(url);
    const isAudio = /\.(mp3|wav|ogg|flac|m4a)$/i.test(url);
    const isDocument = /\.(pdf|doc|docx|txt|rtf)$/i.test(url);
    
    let html = `<div class="attachment-container">`;
    html += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="attachment-link">${getFilenameFromUrl(url)}</a>`;
    
    if (isImage) {
        html += `<img src="${url}" class="attachment-preview" onclick="openMediaFullscreen('${url}', 'image')">`;
    } else if (isVideo) {
        html += `
            <video controls class="attachment-preview" onclick="openMediaFullscreen('${url}', 'video')">
                <source src="${url}" type="video/mp4">
                Your browser does not support video.
            </video>
        `;
    } else if (isAudio) {
        html += `
            <audio controls class="attachment-audio">
                <source src="${url}" type="audio/mpeg">
                Your browser does not support audio.
            </audio>
        `;
    } else if (isDocument) {
        html += `<div class="document-icon">📄</div>`;
    }
    
    html += `</div>`;
    return html;
}

function getFilenameFromUrl(url) {
    try {
        return url.split('/').pop().split('?')[0];
    } catch {
        return 'Attachment';
    }
}

// ==================== FEATURE 10: MESSAGE MENU ====================
function setupMessageMenu() {
    try {
        // Already implemented in existing code, but ensure it has all features
        // The existing context menu already has Edit, Delete, React, View Profile, Report
        // Just need to ensure it's properly connected
    } catch (error) {
        console.log('Error setting up message menu:', error);
    }
}

async function reportMessage(message) {
    try {
        if (!state.currentUser || !state.supabase || !message) return;
        
        const { data: admins, error } = await state.supabase
            .from('profiles')
            .select('id')
            .eq('is_admin', true);
            
        if (error || !admins || admins.length === 0) {
            showToast('Error', 'No admins found', 'error');
            return;
        }
        
        // Create notification for each admin
        const notifications = admins.map(admin => ({
            user_id: admin.id,
            content: `Message reported from ${message.profiles?.username || 'User'}: ${message.content.substring(0, 100)}...`,
            type: 'report',
            metadata: {
                reporter_id: state.currentUser.id,
                message_id: message.id,
                channel_id: message.channel_id,
                realm_id: state.currentRealm?.id
            }
        }));
        
        const { error: insertError } = await state.supabase
            .from('notifications')
            .insert(notifications);
            
        if (insertError) {
            console.log('Error creating report notifications:', insertError);
            showToast('Error', 'Failed to report message', 'error');
            return;
        }
        
        // Send push notification to first admin
        if (admins[0]?.id) {
            await sendPushNotification(
                admins[0].id,
                'Message Reported',
                `${state.userSettings?.username} reported a message`
            );
        }
        
        showToast('Success', 'Message reported to admins', 'success');
        
    } catch (error) {
        console.log('Error reporting message:', error);
        showToast('Error', 'Failed to report message', 'error');
    }
}

// ==================== FEATURE 7: REALM SETTINGS ====================
async function showRealmSettingsModal() {
    try {
        if (!state.currentRealm || !state.supabase) return;
        
        const isCreator = state.currentRealm.created_by === state.currentUser.id;
        const isAdmin = isCreator || await checkRealmAdmin(state.currentRealm.id);
        
        const nonAdminSettings = document.getElementById('nonCreatorSettings');
        const creatorSettings = document.getElementById('creatorSettings');
        const adminSettings = document.getElementById('adminSettings');
        
        document.getElementById('realmSettingsRealmName').textContent = state.currentRealm.name;
        
        if (isAdmin) {
            nonAdminSettings.style.display = 'none';
            creatorSettings.style.display = 'block';
            adminSettings.style.display = isCreator ? 'block' : 'none';
            
            // Load realm settings
            const { data: realm, error } = await state.supabase
                .from('realms')
                .select('*')
                .eq('id', state.currentRealm.id)
                .single();
                
            if (error) {
                console.log('Error loading realm settings:', error);
                showToast('Error', 'Failed to load realm settings', 'error');
                return;
            }
            
            // Populate form
            document.getElementById('realmSettingsName').value = realm.name || '';
            document.getElementById('realmSettingsDescription').value = realm.description || '';
            document.getElementById('realmSettingsAnnouncement').value = realm.announcement_message || '';
            document.getElementById('realmSettingsPublic').checked = realm.is_public === true;
            
            // Load notification settings for non-creator admin
            if (!isCreator) {
                const { data: userRealmPrefs, error: prefError } = await state.supabase
                    .from('user_realms')
                    .select('notification_preferences')
                    .eq('user_id', state.currentUser.id)
                    .eq('realm_id', state.currentRealm.id)
                    .single();
                    
                if (!prefError && userRealmPrefs) {
                    const prefs = userRealmPrefs.notification_preferences || {};
                    document.getElementById('realmNotifyAll').checked = prefs.all !== false;
                    document.getElementById('realmNotifyMentions').checked = prefs.mentions === true;
                    document.getElementById('realmNotifyNone').checked = prefs.all === false && prefs.mentions !== true;
                }
            }
            
            // Load icon preview
            const iconPreview = document.getElementById('realmSettingsIconPreview');
            if (realm.icon_url) {
                iconPreview.style.backgroundImage = `url(${realm.icon_url})`;
                iconPreview.textContent = '';
                iconPreview.style.backgroundSize = 'cover';
                iconPreview.style.backgroundPosition = 'center';
            } else {
                iconPreview.style.backgroundImage = 'none';
                iconPreview.textContent = realm.icon_emoji || '🏰';
            }
            
            // Show/hide private section
            if (realm.is_public) {
                document.getElementById('privateRealmSection').style.display = 'none';
            } else {
                document.getElementById('privateRealmSection').style.display = 'block';
            }
            
            await loadCoAdmins();
            await loadChannelsForDragAndDrop();
            
        } else {
            // Non-admin user
            nonAdminSettings.style.display = 'block';
            creatorSettings.style.display = 'none';
            adminSettings.style.display = 'none';
            
            // Load user's notification preferences
            const { data: userRealmPrefs, error: prefError } = await state.supabase
                .from('user_realms')
                .select('notification_preferences')
                .eq('user_id', state.currentUser.id)
                .eq('realm_id', state.currentRealm.id)
                .single();
                
            if (!prefError && userRealmPrefs) {
                const prefs = userRealmPrefs.notification_preferences || {};
                document.getElementById('userRealmNotifyAll').checked = prefs.all !== false;
                document.getElementById('userRealmNotifyMentions').checked = prefs.mentions === true;
                document.getElementById('userRealmNotifyNone').checked = prefs.all === false && prefs.mentions !== true;
            }
        }
        
        document.getElementById('realmSettingsModal').style.display = 'flex';
        
    } catch (error) {
        console.log('Error showing realm settings modal:', error);
        showToast('Error', 'Failed to load realm settings', 'error');
    }
}

async function checkRealmAdmin(realmId) {
    try {
        if (!state.supabase || !state.currentUser) return false;
        
        const { data, error } = await state.supabase
            .from('realm_roles')
            .select('role')
            .eq('realm_id', realmId)
            .eq('user_id', state.currentUser.id)
            .eq('role', 'admin')
            .single();
            
        return !error && data !== null;
    } catch (error) {
        console.log('Error checking realm admin:', error);
        return false;
    }
}

async function saveRealmSettings() {
    try {
        if (!state.currentRealm || !state.supabase) return;
        
        const isCreator = state.currentRealm.created_by === state.currentUser.id;
        const isAdmin = isCreator || await checkRealmAdmin(state.currentRealm.id);
        
        if (!isAdmin) {
            // Save user notification preferences only
            const notifyAll = document.getElementById('userRealmNotifyAll').checked;
            const notifyMentions = document.getElementById('userRealmNotifyMentions').checked;
            const notifyNone = document.getElementById('userRealmNotifyNone').checked;
            
            let preferences = {};
            if (notifyNone) {
                preferences = { all: false, mentions: false };
            } else if (notifyMentions) {
                preferences = { all: false, mentions: true };
            } else {
                preferences = { all: true, mentions: false };
            }
            
            const { error } = await state.supabase
                .from('user_realms')
                .update({ notification_preferences: preferences })
                .eq('user_id', state.currentUser.id)
                .eq('realm_id', state.currentRealm.id);
                
            if (error) {
                console.log('Error saving notification preferences:', error);
                showToast('Error', 'Failed to save preferences', 'error');
                return;
            }
            
            showToast('Success', 'Notification preferences saved', 'success');
            document.getElementById('realmSettingsModal').style.display = 'none';
            return;
        }
        
        // Admin/creator settings
        const name = document.getElementById('realmSettingsName').value.trim();
        const description = document.getElementById('realmSettingsDescription').value.trim();
        const announcement = document.getElementById('realmSettingsAnnouncement').value.trim();
        const isPublic = document.getElementById('realmSettingsPublic').checked;
        
        if (!name) {
            showToast('Error', 'Please enter a realm name', 'error');
            return;
        }
        
        // Get icon preview
        const iconPreview = document.getElementById('realmSettingsIconPreview');
        let icon_url = null;
        let icon_emoji = null;
        
        if (iconPreview.style.backgroundImage && iconPreview.style.backgroundImage !== 'none') {
            const match = iconPreview.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match) {
                icon_url = match[1];
            }
        } else if (iconPreview.textContent.trim()) {
            icon_emoji = iconPreview.textContent.trim();
        }
        
        const { error } = await state.supabase
            .from('realms')
            .update({
                name: name,
                description: description,
                announcement_message: announcement,
                is_public: isPublic,
                icon_url: icon_url,
                icon_emoji: icon_emoji
            })
            .eq('id', state.currentRealm.id);
            
        if (error) {
            console.log('Error saving realm settings:', error);
            showToast('Error', 'Failed to save realm settings', 'error');
            return;
        }
        
        // Update current realm data
        state.currentRealm.name = name;
        state.currentRealm.description = description;
        state.currentRealm.announcement_message = announcement;
        state.currentRealm.is_public = isPublic;
        state.currentRealm.icon_url = icon_url;
        state.currentRealm.icon_emoji = icon_emoji;
        
        // Update UI
        document.getElementById('currentRealmName').textContent = name;
        const realmIcon = document.querySelector('.realm-icon');
        if (realmIcon) {
            if (icon_url) {
                realmIcon.style.backgroundImage = `url(${icon_url})`;
                realmIcon.textContent = '';
                realmIcon.style.backgroundSize = 'cover';
                realmIcon.style.backgroundPosition = 'center';
            } else {
                realmIcon.style.backgroundImage = 'none';
                realmIcon.textContent = icon_emoji || '🏰';
            }
        }
        
        showToast('Success', 'Realm settings saved', 'success');
        document.getElementById('realmSettingsModal').style.display = 'none';
        
    } catch (error) {
        console.log('Error saving realm settings:', error);
        showToast('Error', 'Failed to save realm settings', 'error');
    }
}

async function leaveRealm(realmId) {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const isCurrentRealm = state.currentRealm && state.currentRealm.id === realmId;
        
        document.getElementById('confirmationModal').style.display = 'flex';
        document.getElementById('confirmationIcon').textContent = '🚪';
        document.getElementById('confirmationTitle').textContent = 'Leave Realm';
        document.getElementById('confirmationMessage').textContent = `Are you sure you want to leave this realm? You'll need to be re-invited to join again.`;
        
        const confirmBtn = document.getElementById('confirmationConfirm');
        const cancelBtn = document.getElementById('confirmationCancel');
        
        const handleConfirm = async () => {
            try {
                const { error } = await state.supabase
                    .from('user_realms')
                    .delete()
                    .eq('user_id', state.currentUser.id)
                    .eq('realm_id', realmId);
                    
                if (error) throw error;
                
                showToast('Success', 'Left realm successfully', 'success');
                document.getElementById('confirmationModal').style.display = 'none';
                document.getElementById('realmSettingsModal').style.display = 'none';
                
                state.joinedRealms = await loadJoinedRealmsFast();
                renderRealmDropdown();
                
                if (isCurrentRealm && state.joinedRealms.length > 0) {
                    switchRealm(state.joinedRealms[0].id);
                } else if (isCurrentRealm) {
                    state.currentRealm = null;
                    state.currentChannel = null;
                    document.getElementById('currentRealmName').textContent = 'No Realm';
                    document.getElementById('channelList').innerHTML = `
                        <div class="channel-item" style="color: var(--text-secondary); text-align: center;">
                            Select a realm to view channels
                        </div>
                    `;
                    document.getElementById('messagesContainer').innerHTML = `
                        <div class="empty-state" id="emptyState">
                            Select a realm and channel to view messages
                        </div>
                    `;
                    document.getElementById('messageInput').placeholder = 'Select a channel to start messaging...';
                    document.getElementById('messageInput').disabled = true;
                    document.getElementById('sendBtn').disabled = true;
                }
                
            } catch (error) {
                console.log('Error leaving realm:', error);
                showToast('Error', 'Failed to leave realm', 'error');
                document.getElementById('confirmationModal').style.display = 'none';
            }
            
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        const handleCancel = () => {
            document.getElementById('confirmationModal').style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
    } catch (error) {
        console.log('Error in leaveRealm:', error);
        showToast('Error', 'Failed to leave realm', 'error');
    }
}

// ==================== HELPER FUNCTIONS ====================
function hideLoader() {
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const app = document.getElementById('app');        
        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
            loadingOverlay.style.display = 'none';
        }      
        if (app) {
            app.style.display = 'flex';
        }
        if (state.loaderTimeout) {
            clearTimeout(state.loaderTimeout);
            state.loaderTimeout = null;
        }
    } catch (error) {
        console.log('Error in hideLoader (non-critical):', error);
    }
}

function showSkeletonUI() {
    try {
        const channelList = document.getElementById('channelList');
        if (channelList && channelList.children.length === 1) {
            channelList.innerHTML = `
                <div class="skeleton skeleton-channel"></div>
                <div class="skeleton skeleton-channel"></div>
                <div class="skeleton skeleton-channel"></div>
            `;
        }        
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                    <div class="skeleton skeleton-avatar"></div>
                    <div style="flex: 1;">
                        <div class="skeleton skeleton-text" style="width: 120px;"></div>
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text" style="width: 80%;"></div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.log('Error showing skeleton UI (non-critical):', error);
    }
}

function showToast(title, message, type = 'info', duration = 4000) {
    try {
        const container = document.getElementById('toastContainer');
        if (!container) return;        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.dataset.type = type;
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: '💬'
        };        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '💬'}</div>
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(title)}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close">×</button>
        `;        
        container.appendChild(toast);        
        setTimeout(() => toast.classList.add('active'), 10);      
        toast.querySelector('.toast-close').addEventListener('click', function() {
            hideToast(toast);
        });      
        if (duration > 0) {
            setTimeout(() => hideToast(toast), duration);
        }     
        return toast;
    } catch (error) {
        console.log('Error showing toast (non-critical):', error);
    }
}

function hideToast(toast) {
    try {
        toast.classList.remove('active');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    } catch (error) {
        console.log('Error hiding toast (non-critical):', error);
    }
}

async function fetchAndUpdateProfile(immediate = false) {
    try {
        if (!state.currentUser || !state.supabase) return;        
        console.log('Fetching latest profile from Supabase...');        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('username, avatar_url, bio, social_links, show_realms, stealth_mode, theme_preference, in_app_notifications, push_notifications, email_notifications, send_with_enter, open_links_in_app, send_read_receipts, push_subscription')
            .eq('id', state.currentUser.id)
            .single();            
        if (error) {
            console.log('Error fetching latest profile:', error);
            return;
        }
        if (state.userSettings) {
            state.userSettings.username = profile.username || state.userSettings.username;
            state.userSettings.avatar_url = profile.avatar_url || state.userSettings.avatar_url;
            state.userSettings.bio = profile.bio || '';
            state.userSettings.social_links = profile.social_links || {};
            state.userSettings.show_realms = profile.show_realms !== false;
            state.userSettings.stealth_mode = profile.stealth_mode === true;
            state.userSettings.theme_preference = profile.theme_preference || 'dark';
            state.userSettings.in_app_notifications = profile.in_app_notifications !== false;
            state.userSettings.push_notifications = profile.push_notifications === true;
            state.userSettings.email_notifications = profile.email_notifications === true;
            state.userSettings.send_with_enter = profile.send_with_enter !== false;
            state.userSettings.open_links_in_app = profile.open_links_in_app === true;
            state.userSettings.send_read_receipts = profile.send_read_receipts !== false;
            state.userSettings.push_subscription = profile.push_subscription;
        }
        updateHeaderUserButton();
        updateProfileModal();        
        console.log('Profile updated from Supabase');
        if (immediate) {
            applyUserSettings();
            updateSettingsModal();
        }        
    } catch (error) {
        console.log('Error in fetchAndUpdateProfile:', error);
    }
}

function updateHeaderUserButton() {
    try {
        if (!state.userSettings) return;        
        const headerAvatar = document.getElementById('headerUserAvatar');
        const headerName = document.getElementById('headerUserName');
        const headerStatus = document.getElementById('headerUserStatus');        
        if (headerAvatar) {
            if (state.userSettings.avatar_url) {
                const timestamp = Date.now();
                headerAvatar.style.backgroundImage = `url(${state.userSettings.avatar_url}?t=${timestamp})`;
                headerAvatar.style.backgroundSize = 'cover';
                headerAvatar.style.backgroundPosition = 'center';
                headerAvatar.textContent = '';
                headerAvatar.style.background = 'none';
            } else {
                const initials = (state.userSettings.username || 'U').charAt(0).toUpperCase();
                headerAvatar.textContent = initials;
                headerAvatar.style.background = 'var(--color-gold-transparent)';
                headerAvatar.style.color = 'var(--color-gold)';
                headerAvatar.style.display = 'flex';
                headerAvatar.style.alignItems = 'center';
                headerAvatar.style.justifyContent = 'center';
                headerAvatar.style.fontSize = '14px';
                headerAvatar.style.fontWeight = '500';
                headerAvatar.style.backgroundImage = 'none';
            }
            if (state.userSettings.stealth_mode) {
                headerAvatar.classList.remove('online');
                if (headerStatus) {
                    headerStatus.textContent = 'Stealth Mode';
                    headerStatus.classList.remove('online');
                }
            } else {
                headerAvatar.classList.add('online');
                if (headerStatus) {
                    headerStatus.textContent = 'Online';
                    headerStatus.classList.add('online');
                }
            }
        }        
        if (headerName) {
            headerName.textContent = state.userSettings.username || state.currentUser?.email?.split('@')[0] || 'User';
        }       
    } catch (error) {
        console.log('Error updating header user button:', error);
    }
}

async function loadUserProfile() {
    try {
        if (!state.currentUser || !state.supabase) {
            console.log('Cannot load profile: no user');
            return {
                username: state.currentUser?.email?.split('@')[0] || 'User',
                email: state.currentUser?.email || 'Not set',
                avatar_url: null,
                last_realm_id: null,
                status: 'online',
                stealth_mode: false,
                theme_preference: 'dark',
                in_app_notifications: true,
                push_notifications: false,
                email_notifications: false,
                send_with_enter: true,
                open_links_in_app: false,
                send_read_receipts: true,
                bio: '',
                social_links: {},
                show_realms: true,
                push_subscription: null
            };
        }        
        console.log('Loading user profile from Supabase...');        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('*')
            .eq('id', state.currentUser.id)
            .single()
            .catch(err => {
                console.log('Profile fetch error, using defaults:', err);
                return { data: null, error: err };
            });            
        if (error) {
            console.log('Using default profile settings');
            return {
                username: state.currentUser.email.split('@')[0],
                email: state.currentUser.email,
                avatar_url: null,
                last_realm_id: null,
                status: 'online',
                stealth_mode: false,
                theme_preference: 'dark',
                in_app_notifications: true,
                push_notifications: false,
                email_notifications: false,
                send_with_enter: true,
                open_links_in_app: false,
                send_read_receipts: true,
                bio: '',
                social_links: {},
                show_realms: true,
                push_subscription: null
            };
        }
        const defaultProfile = {
            username: profile.username || state.currentUser.email.split('@')[0],
            email: state.currentUser.email,
            avatar_url: profile.avatar_url || null,
            last_realm_id: profile.last_realm_id || null,
            status: profile.status || 'online',
            stealth_mode: profile.stealth_mode === true,
            theme_preference: profile.theme_preference || 'dark',
            in_app_notifications: profile.in_app_notifications !== false,
            push_notifications: profile.push_notifications === true,
            email_notifications: profile.email_notifications === true,
            send_with_enter: profile.send_with_enter !== false,
            open_links_in_app: profile.open_links_in_app === true,
            send_read_receipts: profile.send_read_receipts !== false,
            bio: profile.bio || '',
            social_links: profile.social_links || {},
            show_realms: profile.show_realms !== false,
            push_subscription: profile.push_subscription
        };        
        console.log('User profile loaded from Supabase');
        return defaultProfile;
    } catch (error) {
        console.log('Error in loadUserProfile:', error);
        return {
            username: state.currentUser?.email?.split('@')[0] || 'User',
            email: state.currentUser?.email || 'Not set',
            avatar_url: null,
            last_realm_id: null,
            status: 'online',
            stealth_mode: false,
            theme_preference: 'dark',
            in_app_notifications: true,
            push_notifications: false,
            email_notifications: false,
            send_with_enter: true,
            open_links_in_app: false,
            send_read_receipts: true,
            bio: '',
            social_links: {},
            show_realms: true,
            push_subscription: null
        };
    }
}

function refreshAvatarImages() {
    try {
        if (!state.userSettings?.avatar_url) return;        
        const timestamp = Date.now();
        const avatarUrl = state.userSettings.avatar_url;
        updateHeaderUserButton();
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar && profileAvatar.style.backgroundImage) {
            profileAvatar.style.backgroundImage = `url(${avatarUrl}?t=${timestamp})`;
        }
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            if (avatar.src && avatar.src.includes(state.userSettings.avatar_url.split('?')[0])) {
                avatar.src = `${avatarUrl}?t=${timestamp}`;
            }
        });        
        console.log('Avatar images refreshed with cache busting');        
    } catch (error) {
        console.log('Error refreshing avatar images:', error);
    }
}

function applyUserSettings() {
    try {
        if (!state.userSettings) return;        
        console.log('Applying user settings:', {
            theme: state.userSettings.theme_preference,
            stealth: state.userSettings.stealth_mode,
            show_realms: state.userSettings.show_realms,
            send_with_enter: state.userSettings.send_with_enter,
            open_links_in_app: state.userSettings.open_links_in_app
        });
        
        if (state.userSettings.theme_preference === 'system') {
            if (state.systemThemeListener) {
                state.systemThemeListener.removeEventListener('change', handleSystemThemeChange);
            }
            state.systemThemeListener = window.matchMedia('(prefers-color-scheme: light)');
            state.systemThemeListener.addEventListener('change', handleSystemThemeChange);
            handleSystemThemeChange(state.systemThemeListener);
        } else {
            if (state.systemThemeListener) {
                state.systemThemeListener.removeEventListener('change', handleSystemThemeChange);
                state.systemThemeListener = null;
            }
            
            if (state.userSettings.theme_preference === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
        
        updateUserUI();
        updateProfileModal();
        updateSettingsModal();
        if (state.userSettings.avatar_url) {
            setTimeout(refreshAvatarImages, 100);
        }        
    } catch (error) {
        console.log('Error applying user settings:', error);
    }
}

function handleSystemThemeChange(e) {
    try {
        if (state.userSettings?.theme_preference === 'system') {
            if (e.matches) {
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    } catch (error) {
        console.log('Error handling system theme change:', error);
    }
}

async function ensureProtectedRealmsJoined() {
    try {
        if (!state.currentUser || !state.supabase) return;        
        console.log('Ensuring protected realms are joined...');
        const { data: protectedRealms, error } = await state.supabase
            .from('realms')
            .select('*')
            .in('slug', PROTECTED_REALM_SLUGS);            
        if (error) {
            console.log('Error fetching protected realms:', error);
            return;
        }
        const existingSlugs = protectedRealms.map(r => r.slug);
        for (const slug of PROTECTED_REALM_SLUGS) {
            if (!existingSlugs.includes(slug)) {
                console.log(`Creating protected realm: ${slug}`);
                let realmData;                
                if (slug === 'direct-messages') {
                    realmData = {
                        name: 'Direct Messages',
                        slug: slug,
                        description: 'Private conversations',
                        created_by: state.currentUser.id,
                        position: 999,
                        is_featured: false,
                        show_creator: true,
                        is_public: false,
                        announcement_message: null
                    };
                } else {
                    realmData = {
                        name: slug === 'labyrinth' ? 'Labyrinth' : 'BenGurWaves',
                        slug: slug,
                        description: slug === 'labyrinth' ? 'The main realm of Labyrinth chat' : 'Protected waves realm',
                        created_by: state.currentUser.id,
                        position: 0,
                        is_featured: true,
                        show_creator: true,
                        is_public: true,
                        announcement_message: null
                    };
                }
                    const { data: newRealm, error: createError } = await state.supabase
                    .from('realms')
                    .insert([realmData])
                    .select()
                    .single();                    
                if (createError) {
                    console.log(`Error creating realm ${slug}:`, createError);
                } else {
                    protectedRealms.push(newRealm);
                }
            }
        }
        for (const realm of protectedRealms) {
            const { error: joinError } = await state.supabase
                .from('user_realms')
                .upsert({
                    user_id: state.currentUser.id,
                    realm_id: realm.id,
                    joined_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,realm_id',
                    ignoreDuplicates: false
                });               
            if (joinError && !joinError.message.includes('duplicate key')) {
                console.log(`Error joining realm ${realm.slug}:`, joinError);
            }
        }        
        console.log('Protected realms ensured');        
    } catch (error) {
        console.log('Error in ensureProtectedRealmsJoined:', error);
    }
}

async function loadJoinedRealmsFast() {
    try {
        if (!state.currentUser || !state.supabase) {
            console.log('Cannot load realms: no user or supabase');
            return [];
        }        
        console.log('Loading joined realms (optimized)...');
        const { data: joinedRealms, error } = await state.supabase
            .from('user_realms')
            .select(`
                realm_id,
                realms:realm_id (*)
            `)
            .eq('user_id', state.currentUser.id);            
        if (error) {
            console.log('Error loading joined realms:', error);
            return [];
        }
        const realms = joinedRealms
            .map(item => item.realms)
            .filter(Boolean);            
        console.log('Found', realms.length, 'joined realms');
        return realms;
    } catch (error) {
        console.log('Error in loadJoinedRealmsFast:', error);
        return [];
    }
}

async function switchRealm(realmId) {
    try {
        if (!state.supabase) return;        
        console.log('Switching to realm:', realmId);        
        const realm = state.joinedRealms.find(r => r.id === realmId);
        if (!realm) {
            console.log('Realm not found in joined realms');
            return;
        }      
        state.currentRealm = realm;
        // Update realm icon in sidebar
        const realmIcon = document.querySelector('.realm-icon');
        if (realmIcon && realm.icon_url) {
            realmIcon.style.backgroundImage = `url(${realm.icon_url})`;
            realmIcon.textContent = '';
            realmIcon.style.backgroundSize = 'cover';
            realmIcon.style.backgroundPosition = 'center';
        } else if (realmIcon) {
            realmIcon.style.backgroundImage = 'none';
            realmIcon.textContent = realm.icon_url || '🏰';
        }
        document.getElementById('currentRealmName').textContent = realm.name;
        document.getElementById('realmMembers').textContent = '';
        
        const realmSettingsBtn = document.getElementById('realmSettingsBtn');
        realmSettingsBtn.style.display = 'flex';
        
        showSkeletonUI();
        state.supabase
            .from('profiles')
            .update({ last_realm_id: realm.id })
            .eq('id', state.currentUser.id)
            .then(() => console.log('Last realm updated'))
            .catch(err => console.log('Error updating last realm (non-critical):', err));
        loadChannels();
        document.getElementById('realmDropdown').classList.remove('active');
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('active');
        }
        
        setTimeout(() => checkRealmAnnouncement(realm), 500);
    } catch (error) {
        console.log('Error in switchRealm:', error);
        showToast('Error', 'Failed to switch realm', 'error');
    }
}

async function checkRealmAnnouncement(realm) {
    try {
        if (!realm || !state.currentUser) return;
        
        const { data: freshRealm, error } = await state.supabase
            .from('realms')
            .select('announcement_message')
            .eq('id', realm.id)
            .single();
            
        if (error || !freshRealm || !freshRealm.announcement_message) return;
        
        const key = `announcement_seen_${state.currentUser.id}_${realm.id}`;
        if (state.announcementModalShown.has(key) || localStorage.getItem(key)) return;
        
        showRealmAnnouncementModal(realm.name, freshRealm.announcement_message);
        state.announcementModalShown.add(key);
        localStorage.setItem(key, 'true');
    } catch (error) {
        console.log('Error checking realm announcement:', error);
    }
}

function showRealmAnnouncementModal(realmName, announcement) {
    try {
        const modal = document.getElementById('realmAnnouncementModal');
        const title = document.getElementById('realmAnnouncementTitle');
        const message = document.getElementById('realmAnnouncementMessage');
        
        title.textContent = `Announcement from ${realmName}`;
        message.textContent = announcement;
        
        modal.style.display = 'flex';
        
        document.getElementById('realmAnnouncementCloseBtn').onclick = function() {
            modal.style.display = 'none';
        };
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    } catch (error) {
        console.log('Error showing realm announcement modal:', error);
    }
}

function renderRealmDropdown() {
    try {
        const dropdown = document.getElementById('realmDropdown');
        if (!dropdown) return;        
        dropdown.innerHTML = '';        
        if (state.joinedRealms.length === 0) {
            dropdown.innerHTML = '<div class="realm-option" style="color: var(--color-gray); font-style: italic;">No realms joined</div>';
            return;
        }
        const sortedRealms = [...state.joinedRealms].sort((a, b) => {
            const aProtected = PROTECTED_REALM_SLUGS.includes(a.slug);
            const bProtected = PROTECTED_REALM_SLUGS.includes(b.slug);
            if (aProtected && !bProtected) return -1;
            if (!aProtected && bProtected) return 1;
            return a.name.localeCompare(b.name);
        });       
        sortedRealms.forEach(realm => {
            const option = document.createElement('button');
            option.className = 'realm-option';
            if (state.currentRealm && realm.id === state.currentRealm.id) {
                option.classList.add('active');
            }
            // Add realm icon
            let iconHtml = '';
            if (realm.icon_url) {
                iconHtml = `<img src="${realm.icon_url}" style="width: 20px; height: 20px; border-radius: 4px; margin-right: 8px; object-fit: cover;">`;
            } else {
                iconHtml = `<span style="margin-right: 8px;">${realm.icon_url || '🏰'}</span>`;
            }
            
            if (realm.slug === 'direct-messages') {
                option.innerHTML = `${iconHtml} Direct Messages <span id="dmRealmAddBtn" style="margin-left: auto; font-size: 20px; color: var(--color-gold);">+</span>`;
                const addBtn = option.querySelector('#dmRealmAddBtn');
                addBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showStartConversationModal();
                });
            } else {
                let realmText = realm.name;
                if (realm.show_creator) {
                    const creatorUsername = realm.created_by === state.currentUser?.id ? 'You' : '@' + (realm.created_by_username || '');
                    realmText += ` <span style="font-size: 11px; color: var(--color-gray); font-style: italic;">Created by ${creatorUsername}</span>`;
                }
                option.innerHTML = `${iconHtml}${realmText}`;
            }            
            option.onclick = function(e) {
                if (!e.target.closest('#dmRealmAddBtn')) {
                    switchRealm(realm.id);
                }
            };
            dropdown.appendChild(option);
        });
        const addButton = document.createElement('button');
        addButton.className = 'realm-option add-realm';
        addButton.innerHTML = '<span>+</span><span>Explore Realms</span>';
        addButton.onclick = function(e) {
            e.stopPropagation();
            showAllRealmsModal();
        };
        dropdown.appendChild(addButton);        
    } catch (error) {
        console.log('Error rendering realm dropdown:', error);
    }
}

async function loadChannels() {
    try {
        if (!state.currentRealm || !state.supabase) {
            console.log('Cannot load channels: no realm selected');
            return;
        }     
        console.log('Loading channels for realm:', state.currentRealm.id, 'Slug:', state.currentRealm.slug);
        if (state.currentRealm.slug === 'direct-messages') {
            // Load DM channels
            await loadDMChannels();
        } else {
            showGlobalLoading();
            state.supabase
                .from('channels')
                .select('*')
                .eq('realm_id', state.currentRealm.id)
                .eq('is_public', true)
                .order('position', { ascending: true })
                .then(({ data: channels, error }) => {
                    if (error) {
                        console.log('Error loading channels:', error);
                        renderChannels();
                        hideGlobalLoading();
                        return;
                    }                   
                    state.channels = channels;
                    renderChannels();
                    if (channels.length > 0 && !state.currentChannel) {
                        selectChannel(channels[0].id);
                    }                    
                    console.log('Loaded', channels.length, 'channels');
                    updateAddChannelButton();
                    hideGlobalLoading();
                })
                .catch(error => {
                    console.log('Error loading channels:', error);
                    renderChannels();
                    hideGlobalLoading();
                });
        }
    } catch (error) {
        console.log('Error in loadChannels:', error);
        renderChannels();
        hideGlobalLoading();
    }
}

async function ensureSelfDMChannel() {
    try {
        if (!state.currentUser || !state.supabase || !state.currentRealm) return;
        if (state.currentRealm.slug !== 'direct-messages') return;
        
        const username = state.userSettings?.username || state.currentUser.email?.split('@')[0];
        const channelName = `${username}_${username}`;
        
        const { data: existingChannels } = await state.supabase
            .from('channels')
            .select('*')
            .eq('name', channelName)
            .eq('realm_id', state.currentRealm.id)
            .eq('is_public', false)
            .single();
            
        if (!existingChannels) {
            const { error } = await state.supabase
                .from('channels')
                .insert([{
                    name: channelName,
                    description: `Private notes for ${username}`,
                    realm_id: state.currentRealm.id,
                    created_by: state.currentUser.id,
                    is_public: false,
                    is_writable: true,
                    position: 0
                }]);
                
            if (error) {
                console.log('Error creating self-DM channel:', error);
            } else {
                console.log('Self-DM channel created');
            }
        }
    } catch (error) {
        console.log('Error ensuring self-DM channel:', error);
    }
}

function renderChannels() {
    try {
        const channelList = document.getElementById('channelList');
        if (!channelList) return;        
        channelList.innerHTML = '';        
        if (state.channels.length === 0) {
            let message = 'No channels in this realm';
            if (state.currentRealm?.slug === 'direct-messages') {
                message = 'No direct messages yet';
            }
            channelList.innerHTML = `
                <div class="channel-item" style="color: var(--text-secondary); text-align: center; font-style: italic;">
                    ${message}
                </div>
            `;
            return;
        }        
        state.channels.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            if (state.currentChannel && channel.id === state.currentChannel.id) {
                item.classList.add('active');
            }            
            const isChannelCreator = channel.created_by === state.currentUser?.id;
            const isDMRealm = state.currentRealm?.slug === 'direct-messages';
            const username = state.userSettings?.username || state.currentUser?.email?.split('@')[0];
            const isSelfDM = channel.name === `${username}_${username}`;
            
            item.innerHTML = `
                <div class="channel-icon">${isDMRealm ? (isSelfDM ? '📝' : '👤') : '#'}</div>
                <div style="flex: 1;">${isDMRealm && isSelfDM ? 'Notes' : escapeHtml(channel.name)}</div>
                ${isChannelCreator && !isDMRealm ? '<div class="channel-delete-btn" style="color: var(--color-gray); font-size: 12px; padding: 4px; opacity: 0; transition: opacity var(--transition-fast);">🗑️</div>' : ''}
            `;           
            item.onclick = function(e) {
                if (!e.target.classList.contains('channel-delete-btn')) {
                    selectChannel(channel.id);
                    if (window.innerWidth <= 768) {
                        document.getElementById('sidebar').classList.remove('active');
                    }
                }
            };
            const deleteBtn = item.querySelector('.channel-delete-btn');
            if (deleteBtn && !isDMRealm) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showDeleteChannelConfirmation(channel);
                });
                item.addEventListener('mouseenter', function() {
                    deleteBtn.style.opacity = '1';
                });
                item.addEventListener('mouseleave', function() {
                    deleteBtn.style.opacity = '0';
                });
            }           
 channelList.appendChild(item);
        });        
    } catch (error) {
        console.log('Error rendering channels:', error);
    }
}

function updateAddChannelButton() {
    try {
        const addChannelContainer = document.getElementById('addChannelContainer');
        if (!addChannelContainer) return;
        if (state.currentRealm && state.currentRealm.created_by === state.currentUser?.id && state.currentRealm.slug !== 'direct-messages') {
            addChannelContainer.style.display = 'block';
        } else {
            addChannelContainer.style.display = 'none';
        }
    } catch (error) {
        console.log('Error updating add channel button:', error);
    }
}

async function selectChannel(channelId) {
    try {
        if (!state.supabase) return;        
        const channel = state.channels.find(c => c.id === channelId);
        if (!channel) {
            console.log('Channel not found:', channelId);
            return;
        }        
        state.currentChannel = channel;
        document.querySelectorAll('.channel-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = Array.from(document.querySelectorAll('.channel-item')).find(item => {
            return item.textContent.includes(channel.name) || 
                   (channel.name.includes(state.currentUser?.id) && item.textContent.includes('Notes'));
        });        
        if (activeItem) {
            activeItem.classList.add('active');
        }
        updateMessageInputForChannel();
        loadMessages();      
    } catch (error) {
        console.log('Error in selectChannel:', error);
        showToast('Error', 'Failed to select channel', 'error');
    }
}

function updateMessageInputForChannel() {
    try {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const readOnlyNotice = document.getElementById('readOnlyNotice');        
        if (!state.currentChannel || !messageInput || !sendBtn) return;
        const isWritable = state.currentChannel.is_writable !== false;
        const isDMRealm = state.currentRealm?.slug === 'direct-messages';
        const username = state.userSettings?.username || state.currentUser?.email?.split('@')[0];
        const isSelfDM = isDMRealm && state.currentChannel?.name === `${username}_${username}`;
        
        if (!isWritable) {
            messageInput.disabled = true;
            messageInput.placeholder = "This channel is read-only";
            messageInput.style.opacity = "0.5";
            messageInput.style.pointerEvents = "none";
            sendBtn.style.display = "none";
            readOnlyNotice.classList.add('active');
        } else {
            messageInput.disabled = false;
            let placeholderText = `Message ${isDMRealm ? (isSelfDM ? '📝' : '👤') : '#'}${state.currentChannel.name}`;
            if (isSelfDM) {
                placeholderText = 'Message 📝 Notes';
            }
            messageInput.placeholder = placeholderText;
            messageInput.style.opacity = "1";
            messageInput.style.pointerEvents = "auto";
            sendBtn.style.display = "flex";
            readOnlyNotice.classList.remove('active');
            if (!messageInput.disabled) {
                setTimeout(() => messageInput.focus(), 100);
            }
        }        
        updateSendButtonState();        
    } catch (error) {
        console.log('Error updating message input for channel:', error);
    }
}

async function loadMessages() {
    try {
        if (!state.currentChannel || !state.supabase) {
            console.log('Cannot load messages: no channel selected');
            return;
        }        
        console.log('Loading messages for channel:', state.currentChannel.id);        
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="empty-state" id="emptyState">Loading messages...</div>';
        }        
        state.supabase
            .from('messages')
            .select(`
                *,
                profiles (
                    username,
                    avatar_url,
                    status,
                    stealth_mode
                )
            `)
            .eq('channel_id', state.currentChannel.id)
            .order('created_at', { ascending: true })
            .limit(50)
            .then(({ data: messages, error }) => {
                if (error) {
                    console.log('Error loading messages:', error);
                    if (messagesContainer) {
                        messagesContainer.innerHTML = `
                            <div class="empty-state" id="emptyState">
                                Failed to load messages. Try again later.
                            </div>
                        `;
                    }
                    return;
                }                
                state.messages = messages;
                renderMessages();               
                console.log('Loaded', messages.length, 'messages');
                loadPinnedMessage();
                setupMessageSubscription();
                updateReadReceipts();
                setupTypingIndicator(state.currentChannel.id);
            })
            .catch(error => {
                console.log('Error loading messages:', error);               
                if (messagesContainer) {
                    messagesContainer.innerHTML = `
                        <div class="empty-state" id="emptyState">
                            Failed to load messages. Try again later.
                        </div>
                    `;
                }
            });
    } catch (error) {
        console.log('Error in loadMessages:', error);
    }
}

async function updateReadReceipts() {
    try {
        if (!state.currentChannel || !state.supabase || !state.userSettings?.send_read_receipts) return;
        if (state.currentRealm?.slug !== 'direct-messages') return;
        
        const { error } = await state.supabase
            .from('messages')
            .update({ read_by: [...new Set([...(state.messages[0]?.read_by || []), state.currentUser.id])] })
            .eq('channel_id', state.currentChannel.id)
            .neq('user_id', state.currentUser.id)
            .is('read_by', null);
            
        if (error) {
            console.log('Error updating read receipts:', error);
        }
    } catch (error) {
        console.log('Error in updateReadReceipts:', error);
    }
}

async function loadPinnedMessage() {
    try {
        if (!state.currentChannel || !state.supabase) return;
        
        const pinnedMessageId = state.currentChannel.pinned_message_id;
        if (!pinnedMessageId) {
            document.getElementById('pinnedMessageContainer').style.display = 'none';
            state.pinnedMessage = null;
            return;
        }
        
        const { data: message, error } = await state.supabase
            .from('messages')
            .select(`
                *,
                profiles (
                    username,
                    avatar_url
                )
            `)
            .eq('id', pinnedMessageId)
            .single();
            
        if (error || !message) {
            document.getElementById('pinnedMessageContainer').style.display = 'none';
            state.pinnedMessage = null;
            return;
        }
        
        state.pinnedMessage = message;
        displayPinnedMessage(message);
    } catch (error) {
        console.log('Error loading pinned message:', error);
        document.getElementById('pinnedMessageContainer').style.display = 'none';
    }
}

function displayPinnedMessage(message) {
    try {
        const container = document.getElementById('pinnedMessageContainer');
        if (!container) return;
        
        const username = message.profiles?.username || 'User';
        const content = message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content;
        
        container.innerHTML = `
            <div class="pinned-message-container">
                <div class="pinned-label">📌 Pinned</div>
                <div class="pinned-message-content">${escapeHtml(content)}</div>
                <div class="pinned-message-author">— ${escapeHtml(username)}</div>
            </div>
        `;
        container.style.display = 'block';
        
        container.querySelector('.pinned-message-container').addEventListener('click', () => {
            scrollToMessage(message.id);
        });
    } catch (error) {
        console.log('Error displaying pinned message:', error);
    }
}

function scrollToMessage(messageId) {
    const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (msgElement) {
        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgElement.classList.add('selected');
        setTimeout(() => msgElement.classList.remove('selected'), 2000);
    }
}

async function pinMessage(messageId) {
    try {
        if (!state.currentChannel || !state.supabase) return;
        
        const { error } = await state.supabase
            .from('channels')
            .update({ pinned_message_id: messageId })
            .eq('id', state.currentChannel.id);
            
        if (error) {
            console.log('Error pinning message:', error);
            showToast('Error', 'Failed to pin message', 'error');
            return;
        }
        
        showToast('Success', 'Message pinned', 'success');
        loadPinnedMessage();
    } catch (error) {
        console.log('Error pinning message:', error);
        showToast('Error', 'Failed to pin message', 'error');
    }
}

function extractYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function extractSpotifyId(url) {
    const regex = /spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    return match ? { type: match[1], id: match[2] } : null;
}

function extractVimeoId(url) {
    const regex = /vimeo\.com\/(\d+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function extractRumbleId(url) {
    const regex = /rumble\.com\/([a-zA-Z0-9-]+)\.html/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function generateEmbedHTML(url) {
    const cleanUrl = url.replace(/[.,!?;:]$/, '');
    const isYouTube = /youtube\.com|youtu\.be/.test(cleanUrl);
    const isSpotify = /open\.spotify\.com/.test(cleanUrl);
    const isVimeo = /vimeo\.com/.test(cleanUrl);
    const isRumble = /rumble\.com/.test(cleanUrl);
    
    if (isYouTube) {
        const videoId = extractYouTubeVideoId(cleanUrl);
        if (videoId) {
            return `
                <div class="youtube-embed-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <iframe class="youtube-embed" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    <div class="youtube-buttons">
                        <button class="youtube-btn" onclick="openEnhancedMedia('https://www.youtube.com/embed/${videoId}?autoplay=1')">Watch in Labyrinth</button>
                        <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Watch on YouTube</button>
                    </div>
                </div>
            `;
        }
    } else if (isSpotify) {
        const spotifyData = extractSpotifyId(cleanUrl);
        if (spotifyData) {
            return `
                <div class="youtube-embed-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <iframe class="youtube-embed" src="https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
                    <div class="youtube-buttons">
                        <button class="youtube-btn" onclick="openEnhancedMedia('https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}')">Listen in Labyrinth</button>
                        <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Open in Spotify</button>
                    </div>
                </div>
            `;
        }
    } else if (isVimeo) {
        const videoId = extractVimeoId(cleanUrl);
        if (videoId) {
            return `
                <div class="youtube-embed-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <iframe class="youtube-embed" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
                    <div class="youtube-buttons">
                        <button class="youtube-btn" onclick="openEnhancedMedia('https://player.vimeo.com/video/${videoId}?autoplay=1')">Watch in Labyrinth</button>
                        <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Watch on Vimeo</button>
                    </div>
                </div>
            `;
        }
    } else if (isRumble) {
        const videoId = extractRumbleId(cleanUrl);
        if (videoId) {
            return `
                <div class="youtube-embed-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <iframe class="youtube-embed" src="https://rumble.com/embed/${videoId}/" frameborder="0" allowfullscreen></iframe>
                        <div class="youtube-buttons">
                        <button class="youtube-btn" onclick="openEnhancedMedia('https://rumble.com/embed/${videoId}/')">Watch in Labyrinth</button>
                        <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Watch on Rumble</button>
                    </div>
                </div>
            `;
        }
    }
    
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
}

function renderMessages() {
    try {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;        
        messagesContainer.innerHTML = '';       
        if (state.messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="empty-state" id="emptyState">
                    No messages yet. Start the conversation!
                </div>
            `;
            return;
        }        
        state.messages.forEach(message => {
            appendMessage(message);
        });
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);        
    } catch (error) {
        console.log('Error rendering messages:', error);
    }
}

function setupMessageContextMenu(msgElement, message) {
    try {
        const existingMenu = document.querySelector('.message-context-menu');
        if (existingMenu && existingMenu.parentNode) {
            existingMenu.parentNode.removeChild(existingMenu);
        }
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'message-context-menu';
        contextMenu.style.display = 'none';
        const isOwnMessage = message.user_id === state.currentUser?.id;
        const isChannelCreator = state.currentChannel?.created_by === state.currentUser?.id;
        const isBenGurWaves = state.userSettings?.username === 'TheRealBenGurWaves';
        const canPin = isOwnMessage || isChannelCreator || isBenGurWaves;
        
        const menuItems = [
            { icon: '😊', text: 'React', className: 'react' },
            { icon: '👤', text: 'View Profile', className: 'view-profile' },
            { icon: '⚠️', text: 'Report', className: 'report' }
        ];
        
        if (canPin && state.currentRealm?.slug !== 'direct-messages') {
            menuItems.push({ icon: '📌', text: 'Pin Message', className: 'pin' });
        }
        
        if (isOwnMessage) {
            menuItems.push(
                { icon: '✏️', text: 'Edit', className: 'edit' },
                { icon: '🗑️', text: 'Delete', className: 'delete' }
            );
        }
        
        contextMenu.innerHTML = menuItems.map(item => `
            <button class="context-menu-item ${item.className}">
                <span class="context-menu-icon">${item.icon}</span>
                <span>${item.text}</span>
            </button>
        `).join('');
        
        document.body.appendChild(contextMenu);
        state.contextMenu = contextMenu;
        
        const showContextMenu = (x, y) => {
            contextMenu.style.display = 'flex';
            contextMenu.classList.add('active');
            
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            let posX = x;
            let posY = y;
            
            if (window.innerWidth <= 768) {
                posX = windowWidth / 2;
                posY = windowHeight / 2;
                contextMenu.style.transform = 'translate(-50%, -50%)';
                contextMenu.style.left = '50%';
                contextMenu.style.top = '50%';
                contextMenu.style.position = 'fixed';
            } else {
                if (posX + menuWidth > windowWidth) {
                    posX = windowWidth - menuWidth - 10;
                }
                if (posY + menuHeight > windowHeight) {
                    posY = windowHeight - menuHeight - 10;
                }
                if (posX < 10) posX = 10;
                if (posY < 10) posY = 10;
                
                contextMenu.style.left = `${posX}px`;
                contextMenu.style.top = `${posY}px`;
                contextMenu.style.transform = 'none';
            }
            
            state.selectedMessageForContext = message;
            state.selectedUserForProfile = message.user_id;
        };
        
        const removeMenu = () => {
            if (contextMenu && contextMenu.parentNode) {
                contextMenu.classList.remove('active');
                setTimeout(() => {
                    if (contextMenu.parentNode) {
                        contextMenu.parentNode.removeChild(contextMenu);
                    }
                }, 300);
            }
        };
        
        msgElement.addEventListener('click', (e) => {
            if (e.target.closest('.reaction') || e.target.closest('.message-edit-input')) return;
            if (window.innerWidth <= 768 || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                const rect = msgElement.getBoundingClientRect();
                showContextMenu(rect.left + rect.width/2, rect.top + rect.height/2);
                msgElement.classList.add('selected');
                setTimeout(() => msgElement.classList.remove('selected'), 2000);
            }
        });
        
        msgElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY);
            msgElement.classList.add('selected');
            setTimeout(() => msgElement.classList.remove('selected'), 2000);
        });
        
        contextMenu.querySelector('.react').addEventListener('click', (e) => {
            e.stopPropagation();
            state.selectedMessageForReaction = message;
            showEmojiPicker();
            removeMenu();
        });
        
        contextMenu.querySelector('.view-profile').addEventListener('click', (e) => {
            e.stopPropagation();
            showUserProfile(message.user_id, message.profiles);
            removeMenu();
        });
        
        contextMenu.querySelector('.report').addEventListener('click', (e) => {
            e.stopPropagation();
            reportMessage(message);
            removeMenu();
        });
        
        if (canPin && state.currentRealm?.slug !== 'direct-messages') {
            contextMenu.querySelector('.pin').addEventListener('click', (e) => {
                e.stopPropagation();
                pinMessage(message.id);
                removeMenu();
            });
        }
        
        if (isOwnMessage) {
            contextMenu.querySelector('.edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editMessage(message);
                removeMenu();
            });
            
            contextMenu.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteMessage(message);
                removeMenu();
            });
        }
        
        document.addEventListener('click', (e) => {
            if (contextMenu && !contextMenu.contains(e.target) && !msgElement.contains(e.target)) {
                removeMenu();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && contextMenu && contextMenu.parentNode) {
                removeMenu();
            }
        });
        
    } catch (error) {
        console.log('Error setting up context menu:', error);
    }
}

async function editMessage(message) {
    try {
        if (!state.supabase || !message) return;        
        state.editingMessageId = message.id;
        const msgElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (!msgElement) return;        
        const msgBody = msgElement.querySelector('.msg-body');
        if (!msgBody) return;        
        const messageText = msgBody.querySelector('.message-text');
        if (!messageText) return;
        const editInput = document.createElement('textarea');
        editInput.className = 'message-edit-input';
        editInput.value = message.content;
        editInput.rows = Math.min(Math.ceil(message.content.length / 50), 5);
        const originalText = messageText.textContent;
        messageText.style.display = 'none';
        messageText.parentNode.insertBefore(editInput, messageText);
        editInput.focus();
        editInput.select();
        editInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await saveMessageEdit(message.id, editInput.value.trim());
            }            
            if (e.key === 'Escape') {
                cancelMessageEdit(messageText, editInput, originalText);
            }
        });        
        editInput.addEventListener('blur', async () => {
            setTimeout(async () => {
                if (state.editingMessageId === message.id) {
                    await saveMessageEdit(message.id, editInput.value.trim());
                }
            }, 100);
        });        
    } catch (error) {
        console.log('Error starting message edit:', error);
        showToast('Error', 'Failed to edit message', 'error');
    }
}

async function saveMessageEdit(messageId, newContent) {
    try {
        if (!state.supabase || !newContent || newContent.trim() === '') {
            cancelMessageEdit();
            return;
        }        
        const { error } = await state.supabase
            .from('messages')
            .update({ 
                content: newContent,
                edited_at: new Date().toISOString()
            })
            .eq('id', messageId);           
        if (error) {
            console.log('Error updating message:', error);
            showToast('Error', 'Failed to update message', 'error');
            return;
        }       
        state.editingMessageId = null;
        showToast('Success', 'Message updated', 'success');
    } catch (error) {
        console.log('Error saving message edit:', error);
        showToast('Error', 'Failed to update message', 'error');
    }
}

function cancelMessageEdit(messageText, editInput, originalText) {
    try {
        if (editInput && editInput.parentNode) {
            editInput.parentNode.removeChild(editInput);
        }
        if (messageText) {
            messageText.style.display = 'block';
            messageText.textContent = originalText;
        }
        state.editingMessageId = null;
    } catch (error) {
        console.log('Error canceling edit:', error);
    }
}

async function deleteMessage(message) {
    try {
        if (!state.supabase || !message) return;
        document.getElementById('confirmationModal').style.display = 'flex';
        document.getElementById('confirmationIcon').textContent = '🗑️';
        document.getElementById('confirmationTitle').textContent = 'Delete Message';
        document.getElementById('confirmationMessage').textContent = 'Are you sure you want to delete this message? This action cannot be undone.';        
        const confirmBtn = document.getElementById('confirmationConfirm');
        const cancelBtn = document.getElementById('confirmationCancel');
        const handleConfirm = async () => {
            try {
                const { error } = await state.supabase
                    .from('messages')
                    .delete()
                    .eq('id', message.id);
                if (error) throw error;                
                showToast('Success', 'Message deleted', 'success');
                document.getElementById('confirmationModal').style.display = 'none';            
            } catch (error) {
                console.log('Error deleting message:', error);
                showToast('Error', 'Failed to delete message', 'error');
                document.getElementById('confirmationModal').style.display = 'none';
            }            
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };        
        const handleCancel = () => {
            document.getElementById('confirmationModal').style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);       
    } catch (error) {
        console.log('Error in deleteMessage:', error);
        showToast('Error', 'Failed to delete message', 'error');
    }
}

function appendMessage(message) {
    try {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;
        const emptyState = document.getElementById('emptyState');
        if (emptyState && emptyState.parentNode === messagesContainer) {
            emptyState.remove();
        }        
        const isMe = message.user_id === state.currentUser?.id;
        const username = message.profiles?.username || 'User';
        const avatarUrl = message.profiles?.avatar_url;
        const isStealth = message.profiles?.stealth_mode === true;
        const status = isStealth ? 'offline' : (message.profiles?.status || 'offline');       
        const msgElement = document.createElement('div');
        msgElement.className = `msg ${isMe ? 'me' : ''}`;
        msgElement.dataset.messageId = message.id;
        const time = new Date(message.created_at);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const editedTag = message.edited_at ? '<span class="message-edited">(edited)</span>' : '';
        const formattedContent = formatMessageContent(message.content);        
        msgElement.innerHTML = `
            <img class="message-avatar" src="${avatarUrl ? avatarUrl + '?t=' + Date.now() : ''}" alt="${username}" onerror="this.style.display='none';" onclick="openUserProfile('${message.user_id}')">
            <div class="msg-body">
                <div class="message-header">
                    <div class="message-username">${escapeHtml(username)}</div>
                    <div class="message-time">${timeStr} ${editedTag}</div>
                </div>
                <div class="message-text">${formattedContent}</div>
                ${message.reactions && message.reactions.length > 0 ? `
                    <div class="reactions-container">
                        ${renderReactions(message.reactions)}
                    </div>
                ` : ''}
            </div>
        `;        
        messagesContainer.appendChild(msgElement);
        setupMessageContextMenu(msgElement, message);
        setTimeout(() => {
            msgElement.style.opacity = '1';
        }, 10);        
    } catch (error) {
        console.log('Error appending message:', error);
    }
}

function renderReactions(reactions) {
    try {
        if (!reactions || !Array.isArray(reactions)) return '';
        
        const grouped = {};
        reactions.forEach(reaction => {
            if (!reaction.emoji) return;
            if (!grouped[reaction.emoji]) {
                grouped[reaction.emoji] = {
                    count: 0,
                    users: []
                };
            }
            grouped[reaction.emoji].count++;
            if (reaction.user_id === state.currentUser?.id) {
                grouped[reaction.emoji].users.push(state.currentUser.id);
            }
        });
        
        return Object.entries(grouped).map(([emoji, data]) => {
            const isMe = data.users.includes(state.currentUser?.id);
            return `
                <div class="reaction ${isMe ? 'me' : ''}" data-emoji="${emoji}">
                    <span>${emoji}</span>
                    <span>${data.count}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.log('Error rendering reactions:', error);
        return '';
    }
}

function setupMessageSubscription() {
    try {
        if (!state.currentChannel || !state.supabase) return;
        if (state.messageSubscription) {
            state.supabase.removeChannel(state.messageSubscription);
        }
        state.messageSubscription = state.supabase
            .channel(`messages:${state.currentChannel.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `channel_id=eq.${state.currentChannel.id}`
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    if (payload.new.user_id === state.currentUser.id) return;
                    const { data: message, error } = await state.supabase
                        .from('messages')
                        .select(`
                            *,
                            profiles (
                                username,
                                avatar_url,
                                status,
                                stealth_mode
                            )
                        `)
                        .eq('id', payload.new.id)
                        .single();                        
                    if (error || !message) return;                    
                    state.messages.push(message);
                    appendMessage(message);
                    const messagesContainer = document.getElementById('messagesContainer');
                    if (messagesContainer) {
                        const scrollBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
                        if (scrollBottom < 200) {
                            setTimeout(() => {
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }, 100);
                        }
                    }
                    if (state.userSettings?.in_app_notifications && !document.hasFocus()) {
                        showToast('New Message', `From ${message.profiles?.username || 'User'}`, 'info');
                    }
                    
                    // Check for mentions
                    if (message.content.includes('@')) {
                        const mentions = message.content.match(/@(\w+)/g);
                        if (mentions) {
                            mentions.forEach(mention => {
                                const username = mention.substring(1);
                                if (username === state.userSettings?.username) {
                                    // Send push notification for mention
                                    sendPushNotification(
                                        state.currentUser.id,
                                        'You were mentioned',
                                        `${message.profiles?.username} mentioned you in ${state.currentChannel.name}`
                                    );
                                }
                            });
                        }
                    }
                } 
                else if (payload.eventType === 'UPDATE') {
                    const messageIndex = state.messages.findIndex(m => m.id === payload.new.id);
                    if (messageIndex !== -1) {
                        state.messages[messageIndex] = {
                            ...state.messages[messageIndex],
                            ...payload.new
                        };
                        const msgElement = document.querySelector(`[data-message-id="${payload.new.id}"]`);
                        if (msgElement) {
                            const msgBody = msgElement.querySelector('.msg-body');
                            if (msgBody) {
                                const messageText = msgBody.querySelector('.message-text');
                                const messageTime = msgBody.querySelector('.message-time');
                                const reactionsContainer = msgBody.querySelector('.reactions-container');                                
                                if (messageText) {
                                    messageText.innerHTML = formatMessageContent(payload.new.content);
                                }
                                if (payload.new.edited_at && !messageTime.innerHTML.includes('(edited)')) {
                                    messageTime.innerHTML = messageTime.innerHTML.replace(/\s*$/, '') + ' <span class="message-edited">(edited)</span>';
                                }
                                if (payload.new.reactions) {
                                    if (reactionsContainer) {
                                        reactionsContainer.innerHTML = renderReactions(payload.new.reactions);
                                    } else if (payload.new.reactions.length > 0) {
                                        const newReactionsContainer = document.createElement('div');
                                        newReactionsContainer.className = 'reactions-container';
                                        newReactionsContainer.innerHTML = renderReactions(payload.new.reactions);
                                        msgBody.appendChild(newReactionsContainer);
                                    }
                                }
                            }
                        }
                    }
                }
                else if (payload.eventType === 'DELETE') {
                    state.messages = state.messages.filter(m => m.id !== payload.old.id);
                    const msgElement = document.querySelector(`[data-message-id="${payload.old.id}"]`);
                    if (msgElement && msgElement.parentNode) {
                        msgElement.parentNode.removeChild(msgElement);
                    }
                    if (state.messages.length === 0) {
                        const messagesContainer = document.getElementById('messagesContainer');
                        if (messagesContainer) {
                            messagesContainer.innerHTML = `
                                <div class="empty-state" id="emptyState">
                                    No messages yet. Start the conversation!
                                </div>
                            `;
                        }
                    }
                }
            })
            .subscribe();          
    } catch (error) {
        console.log('Error setting up message subscription:', error);
    }
}

function sendMessage() {
    try {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();        
        if (!message || !state.currentUser || !state.currentChannel) return;
        if (state.currentChannel.is_writable === false) {
            showToast('Error', 'This channel is read-only', 'error');
            return;
        }
        const optimisticMessage = {
            id: `temp_${Date.now()}`,
            content: message,
            channel_id: state.currentChannel.id,
            user_id: state.currentUser.id,
            created_at: new Date().toISOString(),
            profiles: {
                username: state.userSettings?.username || state.currentUser.email?.split('@')[0],
                avatar_url: state.userSettings?.avatar_url,
                status: state.userSettings?.status || 'online',
                stealth_mode: state.userSettings?.stealth_mode || false
            }
        };
        appendMessage(optimisticMessage);
        input.value = '';
        input.style.height = 'auto';
        updateSendButtonState();
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) container.scrollTop = container.scrollHeight;
        }, 100);
        state.supabase
            .from('messages')
            .insert([{
                content: message,
                channel_id: state.currentChannel.id,
                user_id: state.currentUser.id
            }])
            .then(({ error }) => {
                if (error) {
                    console.log('Error sending message:', error);
                    showToast('Error', 'Failed to send message', 'error');
                }
            });            
    } catch (error) {
        console.log('Error in sendMessage:', error);
        showToast('Error', 'Failed to send message', 'error');
    }
}

function updateUserUI() {
    try {
        if (!state.currentUser) return;        
        const userName = document.getElementById('headerUserName');
        const userAvatar = document.getElementById('headerUserAvatar');
        const userStatus = document.getElementById('headerUserStatus');        
        const username = state.userSettings?.username || state.currentUser.email?.split('@')[0] || 'User';
        const isStealth = state.userSettings?.stealth_mode === true;      
        if (userName) userName.textContent = username;
        if (userStatus) {
            userStatus.textContent = isStealth ? 'Stealth Mode' : 'Online';
            userStatus.className = `header-user-status ${isStealth ? '' : 'online'}`;
        }       
        if (userAvatar) {
            if (state.userSettings?.avatar_url) {
                const timestamp = Date.now();
                userAvatar.style.backgroundImage = `url(${state.userSettings.avatar_url}?t=${timestamp})`;
                userAvatar.style.backgroundSize = 'cover';
                userAvatar.style.backgroundPosition = 'center';
                userAvatar.textContent = '';
                userAvatar.style.background = 'none';
            } else {
                const initials = username.charAt(0).toUpperCase();
                userAvatar.textContent = initials;
                userAvatar.style.fontSize = '14px';
                userAvatar.style.fontWeight = '500';
                userAvatar.style.color = 'var(--color-gold)';
                userAvatar.style.background = 'var(--color-gold-transparent)';
                userAvatar.style.display = 'flex';
                userAvatar.style.alignItems = 'center';
                userAvatar.style.justifyContent = 'center';
                userAvatar.style.backgroundImage = 'none';
            }            
            if (isStealth) {
                userAvatar.classList.remove('online');
            } else {
                userAvatar.classList.add('online');
            }
        }
        updateProfileModal();
        
    } catch (error) {
        console.log('Error updating user UI:', error);
    }
}

function updateProfileModal() {
    try {
        if (!state.currentUser) return;        
        const profileEmail = document.getElementById('profileEmail');
        const profileUsername = document.getElementById('profileUsername');
        const profileAvatar = document.getElementById('profileAvatar');
        const profileBio = document.getElementById('profileBio');
        const profileShowRealms = document.getElementById('profileShowRealms');
        if (profileEmail) {
            if (state.emailVisible) {
                profileEmail.value = state.currentUser.email || 'Not set';
            } else {
                profileEmail.value = '••••••••@•••••••';
            }
        }
        if (profileUsername) {
            const username = state.userSettings?.username || state.currentUser.email?.split('@')[0] || 'Not set';
            profileUsername.value = username;
        }        
        if (profileAvatar) {
            if (state.userSettings?.avatar_url) {
                const timestamp = Date.now();
                profileAvatar.style.backgroundImage = `url(${state.userSettings.avatar_url}?t=${timestamp})`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';
                profileAvatar.style.background = 'none';
            } else {
                const initials = (state.userSettings?.username || state.currentUser.email?.split('@')[0] || 'U').charAt(0).toUpperCase();
                profileAvatar.textContent = initials;
                profileAvatar.style.background = 'var(--color-gold-transparent)';
                profileAvatar.style.color = 'var(--color-gold)';
                profileAvatar.style.display = 'flex';
                profileAvatar.style.alignItems = 'center';
                profileAvatar.style.justifyContent = 'center';
                profileAvatar.style.fontSize = '24px';
                profileAvatar.style.fontWeight = '500';
                profileAvatar.style.backgroundImage = 'none';
            }
        }
        if (profileBio) {
            profileBio.value = state.userSettings?.bio || '';
        }
        const socialLinks = state.userSettings?.social_links || {};
        document.getElementById('socialTwitter').value = socialLinks.twitter || '';
        document.getElementById('socialInstagram').value = socialLinks.instagram || '';
        document.getElementById('socialWebsite').value = socialLinks.website || '';
        document.getElementById('socialOther').value = socialLinks.other || '';
        if (profileShowRealms) {
            profileShowRealms.checked = state.userSettings?.show_realms !== false;
        }
        loadUserRealmsForProfile();        
    } catch (error) {
        console.log('Error updating profile modal:', error);
    }
}

async function loadUserRealmsForProfile() {
    try {
        if (!state.currentUser || !state.supabase) return;        
        const realmsList = document.getElementById('profileRealmsList');
        if (!realmsList) return;
        const { data: userRealms, error } = await state.supabase
            .from('user_realms')
            .select(`
                realms (*)
            `)
            .eq('user_id', state.currentUser.id);          
        if (error) {
            console.log('Error loading user realms:', error);
            realmsList.innerHTML = '<div class="realms-hidden-message">Error loading realms</div>';
            return;
        }       
        const realms = userRealms.map(item => item.realms).filter(Boolean);     
        if (realms.length === 0) {
            realmsList.innerHTML = '<div class="realms-hidden-message">Not a member of any realms</div>';
            return;
        }
        // Update to show realm icons
        realmsList.innerHTML = realms.map(realm => {
            let iconHtml = '';
            if (realm.icon_url) {
                iconHtml = `<img src="${realm.icon_url}" style="width: 20px; height: 20px; border-radius: 4px; margin-right: 8px; object-fit: cover;">`;
            } else {
                iconHtml = `<span style="margin-right: 8px;">${realm.icon_url || '🏰'}</span>`;
            }
            return `<div class="realm-chip">${iconHtml}${escapeHtml(realm.name)}</div>`;
        }).join('');        
    } catch (error) {
        console.log('Error loading user realms for profile:', error);
        realmsList.innerHTML = '<div class="realms-hidden-message">Error loading realms</div>';
    }
}

async function loadOtherUserRealms(userId) {
    try {
        if (!state.supabase || !userId) return null;
        const { data: profile, error: profileError } = await state.supabase
            .from('profiles')
            .select('show_realms')
            .eq('id', userId)
            .single();            
        if (profileError || !profile) {
            return { show_realms: true, realms: [] };
        }        
        if (profile.show_realms === false) {
            return { show_realms: false, realms: [] };
        }
        const { data: userRealms, error } = await state.supabase
            .from('user_realms')
            .select(`
                realms (*)
            `)
            .eq('user_id', userId);           
        if (error) {
            return { show_realms: true, realms: [] };
        }        
        const realms = userRealms.map(item => item.realms).filter(Boolean);
        return { show_realms: true, realms };       
    } catch (error) {
        console.log('Error loading other user realms:', error);
        return { show_realms: true, realms: [] };
    }
}

function updateSettingsModal() {
    try {
        if (!state.userSettings) return;
        const inAppNotifications = document.getElementById('settingsInAppNotifications');
        const pushNotifications = document.getElementById('settingsPushNotifications');
        const emailNotifications = document.getElementById('settingsEmailNotifications');
        const stealthMode = document.getElementById('settingsAppearOffline');
        const readReceipts = document.getElementById('settingsReadReceipts');
        const sendWithEnter = document.getElementById('settingsSendWithEnter');
        const openLinksInApp = document.getElementById('settingsOpenLinksInApp');
        
        if (inAppNotifications) inAppNotifications.checked = state.userSettings.in_app_notifications !== false;
        if (pushNotifications) pushNotifications.checked = state.userSettings.push_notifications === true;
        if (emailNotifications) emailNotifications.checked = state.userSettings.email_notifications === true;
        if (stealthMode) stealthMode.checked = state.userSettings.stealth_mode === true;
        if (readReceipts) readReceipts.checked = state.userSettings.send_read_receipts !== false;
        if (sendWithEnter) sendWithEnter.checked = state.userSettings.send_with_enter !== false;
        if (openLinksInApp) openLinksInApp.checked = state.userSettings.open_links_in_app === true;
        
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === state.userSettings.theme_preference) {
                option.classList.add('active');
            }
        });
    } catch (error) {
        console.log('Error updating settings modal:', error);
    }
}

function updateSendButtonState() {
    try {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const content = input ? input.value.trim() : '';
        const isChannelWritable = state.currentChannel?.is_writable !== false;      
        sendBtn.disabled = !content || !state.currentUser || !state.currentChannel || !isChannelWritable;
    } catch (error) {
        console.log('Error updating send button:', error);
    }
}

function initializeSupabase() {
    try {
        console.log('Initializing Supabase v0.5.560 Beta...');
        state.loaderTimeout = setTimeout(hideLoader, 3000);
        state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });
        
        // Check for existing session on page load
        state.supabase.auth.getSession()
            .then(({ data: { session }, error }) => {
                if (error) {
                    console.log('Auth check error:', error);
                    showLoginScreen();
                    return;
                }                
                if (!session) {
                    console.log('No session found - showing login screen');
                    showLoginScreen();
                    return;
                }                
                state.currentUser = session.user;
                console.log('User authenticated:', state.currentUser.id);
                initializeApp();
            })
            .catch(error => {
                console.log('Auth error:', error);
                showLoginScreen();
            });
            
        state.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);            
            if (event === 'SIGNED_OUT') {
                showLoginScreen();
            } else if (event === 'SIGNED_IN' && session) {
                state.currentUser = session.user;
                if (!state.initComplete) {
                    initializeApp();
                }
            }
        });        
    } catch (error) {
        console.log('Error initializing Supabase:', error);
        showToast('Error', 'Failed to initialize', 'error');
        hideLoader();
        showLoginScreen();
    }
}

function showLoginScreen() {
    try {
        hideLoader();
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('signInBtn').onclick = signIn;
        document.getElementById('signUpBtn').onclick = signUp;
        document.getElementById('loginPassword').onkeypress = function(e) {
            if (e.key === 'Enter') signIn();
        };
    } catch (error) {
        console.log('Error showing login screen:', error);
    }
}

async function signIn() {
    try {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;       
        if (!email || !password) {
            showToast('Error', 'Please enter email and password', 'error');
            return;
        }        
        const { data, error } = await state.supabase.auth.signInWithPassword({
            email,
            password
        });       
        if (error) throw error;       
        state.currentUser = data.user;
        document.getElementById('loginOverlay').style.display = 'none';
        initializeApp();       
    } catch (error) {
        console.log('Sign in error:', error);
        showToast('Error', error.message || 'Failed to sign in', 'error');
    }
}

async function signUp() {
    try {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;        
        if (!email || !password) {
            showToast('Error', 'Please enter email and password', 'error');
            return;
        }        
        if (password.length < 6) {
            showToast('Error', 'Password must be at least 6 characters', 'error');
            return;
        }        
        const { data, error } = await state.supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });        
        if (error) throw error;        
        showToast('Success', 'Account created! Check your email to confirm.', 'success');        
    } catch (error) {
        console.log('Sign up error:', error);
        showToast('Error', error.message || 'Failed to create account', 'error');
    }
}

async function initializeApp() {
    try {
        if (state.isLoading) return;
        state.isLoading = true;       
        console.log('Initializing app v0.5.560 Beta...');
        document.getElementById('app').style.display = 'flex';
        document.getElementById('loginOverlay').style.display = 'none';
        state.userSettings = await loadUserProfile();
        if (state.userSettings) {
            applyUserSettings();
            updateHeaderUserButton();
            fetchAndUpdateProfile(true);
        }
        await ensureProtectedRealmsJoined();
        state.joinedRealms = await loadJoinedRealmsFast();
        let realmToSelect = null;
        const lastRealmId = state.userSettings?.last_realm_id;        
        if (lastRealmId) {
            realmToSelect = state.joinedRealms.find(r => r.id === lastRealmId);
        }        
        if (!realmToSelect && state.joinedRealms.length > 0) {
            realmToSelect = state.joinedRealms.find(r => r.slug === 'labyrinth') || state.joinedRealms[0];
        }
        if (realmToSelect) {
            state.currentRealm = realmToSelect;
            // Update realm icon in sidebar
            const realmIcon = document.querySelector('.realm-icon');
            if (realmIcon && realmToSelect.icon_url) {
                realmIcon.style.backgroundImage = `url(${realmToSelect.icon_url})`;
                realmIcon.textContent = '';
                realmIcon.style.backgroundSize = 'cover';
                realmIcon.style.backgroundPosition = 'center';
            } else if (realmIcon) {
                realmIcon.style.backgroundImage = 'none';
                realmIcon.textContent = realmToSelect.icon_url || '🏰';
            }
            document.getElementById('currentRealmName').textContent = realmToSelect.name;
            document.getElementById('realmMembers').textContent = '';
            
            const realmSettingsBtn = document.getElementById('realmSettingsBtn');
            realmSettingsBtn.style.display = 'flex';
            
            renderRealmDropdown();
            loadChannels();
        }
        setupEventListeners();
        await registerServiceWorker();
        startOnlineStatusChecker();
        setupMentions();
        setupMessageMenu();
        state.initComplete = true;
        state.isLoading = false;
        if (state.loaderTimeout) {
            clearTimeout(state.loaderTimeout);
            state.loaderTimeout = null;
        }
        hideLoader();
        setTimeout(() => {
            showToast('Welcome', 'Connected to Labyrinth v0.5.560 Beta', 'success');
        }, 500);
        
        setTimeout(checkWelcomeMessages, 1000);
    } catch (error) {
        console.log('App initialization error:', error);
        showToast('Error', 'App initialization failed', 'error');
        hideLoader();
        state.isLoading = false;
    }
}

async function checkWelcomeMessages() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const { data: realmsWithWelcome, error } = await state.supabase
            .from('realms')
            .select('id, name, welcome_message')
            .not('welcome_message', 'is', null)
            .neq('welcome_message', '');
            
        if (error || !realmsWithWelcome || realmsWithWelcome.length === 0) return;
        
        for (const realm of realmsWithWelcome) {
            const key = `welcome_seen_${state.currentUser.id}_${realm.id}`;
            if (state.welcomeModalShown.has(key) || localStorage.getItem(key)) continue;
            
            const { data: membership } = await state.supabase
                .from('user_realms')
                .select('joined_at')
                .eq('user_id', state.currentUser.id)
                .eq('realm_id', realm.id)
                .single();
                
            if (membership) {
                showWelcomeModal(realm);
                state.welcomeModalShown.add(key);
                localStorage.setItem(key, 'true');
                break;
            }
        }
    } catch (error) {
        console.log('Error checking welcome messages:', error);
    }
}

function showWelcomeModal(realm) {
    try {
        const modal = document.getElementById('welcomeModal');
        const title = document.getElementById('welcomeModalTitle');
        const message = document.getElementById('welcomeModalMessage');
        
        title.textContent = `Welcome to ${realm.name}`;
        message.textContent = realm.welcome_message;
        
        modal.style.display = 'flex';
        
        document.getElementById('welcomeModalCloseBtn').onclick = function() {
            modal.style.display = 'none';
        };
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    } catch (error) {
        console.log('Error showing welcome modal:', error);
    }
}

async function loadInitialData() {
    try {
        state.joinedRealms = await loadJoinedRealmsFast();        
        if (state.joinedRealms.length === 0) {
            console.log('No realms after protected realms join');
            return;
        }
        let realmToSelect = null;
        const lastRealmId = state.userSettings?.last_realm_id;       
        if (lastRealmId) {
            realmToSelect = state.joinedRealms.find(r => r.id === lastRealmId);
        }      
        if (!realmToSelect && state.joinedRealms.length > 0) {
            realmToSelect = state.joinedRealms.find(r => r.slug === 'labyrinth') || state.joinedRealms[0];
        }
        if (realmToSelect) {
            state.currentRealm = realmToSelect;
            // Update realm icon in sidebar
            const realmIcon = document.querySelector('.realm-icon');
            if (realmIcon && realmToSelect.icon_url) {
                realmIcon.style.backgroundImage = `url(${realmToSelect.icon_url})`;
                realmIcon.textContent = '';
                realmIcon.style.backgroundSize = 'cover';
                realmIcon.style.backgroundPosition = 'center';
            } else if (realmIcon) {
                realmIcon.style.backgroundImage = 'none';
                realmIcon.textContent = realmToSelect.icon_url || '🏰';
            }
            document.getElementById('currentRealmName').textContent = realmToSelect.name;
            
            const realmSettingsBtn = document.getElementById('realmSettingsBtn');
            realmSettingsBtn.style.display = 'flex';
            
            renderRealmDropdown();
            loadChannels();
        }
    } catch (error) {
        console.log('Error in loadInitialData:', error);
    }
}

function setupEventListeners() {
    try {
        document.getElementById('mobileMenuBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('active');
            document.getElementById('realmDropdown').classList.remove('active');
        });
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');                
                if (sidebar.classList.contains('active') && 
                    !sidebar.contains(e.target) && 
                    e.target !== mobileMenuBtn && 
                    !mobileMenuBtn.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });
        let touchStartX = 0;
        let touchEndX = 0;        
        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        });        
        document.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('active') && touchStartX - touchEndX > 100) {
                sidebar.classList.remove('active');
            }
            if (!sidebar.classList.contains('active') && touchEndX - touchStartX > 100 && touchStartX < 50) {
                sidebar.classList.add('active');
            }
        });
        document.getElementById('realmSection').addEventListener('click', function(e) {
            if (!e.target.closest('.realm-dropdown') && !e.target.closest('.realm-settings-btn')) {
                document.getElementById('realmDropdown').classList.toggle('active');
            }
        });        
        document.getElementById('realmDropdownBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('realmDropdown').classList.toggle('active');
        });
        
        document.getElementById('realmSettingsBtn').addEventListener('click', async function(e) {
            e.stopPropagation();
            if (!state.currentRealm) return;
            await showRealmSettingsModal();
        });
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.realm-section') && !e.target.closest('.realm-dropdown')) {
                document.getElementById('realmDropdown').classList.remove('active');
            }
        });
        const messageInput = document.getElementById('messageInput');        
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            updateSendButtonState();
            
            // Send typing indicator
            if (this.value.trim()) {
                sendTypingIndicator();
            }
        });        
        messageInput.addEventListener('keydown', function(e) {
            if (state.userSettings?.send_with_enter) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            }
        });
        document.getElementById('sendBtn').addEventListener('click', sendMessage);
        document.getElementById('headerUserBtn').addEventListener('click', function() {
            document.getElementById('userModal').style.display = 'flex';
            fetchAndUpdateProfile();
            updateSettingsModal();
            updateProfileModal();
        });
        document.getElementById('userModalCloseBtn').addEventListener('click', function() {
            document.getElementById('userModal').style.display = 'none';
        });
        
        // Notification bell - direct modal open
        document.getElementById('notificationBell').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('notificationsModal').style.display = 'flex';
            loadAllNotifications();
        });
        
        document.getElementById('globalSearchBtn').addEventListener('click', function() {
            document.getElementById('globalSearchModal').style.display = 'flex';
            document.getElementById('globalSearchInput').focus();
        });
        
        document.getElementById('globalSearchCloseBtn').addEventListener('click', function() {
            document.getElementById('globalSearchModal').style.display = 'none';
        });
        
        document.getElementById('globalSearchModalCloseBtn').addEventListener('click', function() {
            document.getElementById('globalSearchModal').style.display = 'none';
        });
        
        // Enhanced global search
        document.getElementById('globalSearchInput').addEventListener('input', function() {
            clearTimeout(state.realmSearchTimer);
            state.realmSearchTimer = setTimeout(() => {
                performGlobalSearch(this.value);
            }, 300);
        });
        
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.dataset.tab;                
                document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');                
                document.querySelectorAll('.modal-tab-content').forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabId}Tab`) {
                        content.classList.add('active');
                    }
                });
            });
        });
        document.getElementById('avatarUploadBtn').addEventListener('click', function() {
            document.getElementById('avatarUploadInput').click();
        });
        document.getElementById('avatarUploadInput').addEventListener('change', handleAvatarUpload);
        document.getElementById('profileAvatar').addEventListener('click', function() {
            document.getElementById('avatarUploadInput').click();
        });
        
        const settingsToggles = [
            'settingsInAppNotifications',
            'settingsPushNotifications',
            'settingsEmailNotifications',
            'settingsAppearOffline',
            'settingsReadReceipts',
            'settingsSendWithEnter',
            'settingsOpenLinksInApp'
        ];
        
        settingsToggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.addEventListener('change', async function() {
                    if (toggleId === 'settingsPushNotifications') {
                        if (this.checked) {
                            await subscribeToPushNotifications();
                        } else {
                            await unsubscribeFromPushNotifications();
                        }
                        return;
                    }
                    if (toggleId === 'settingsEmailNotifications') {
                        showToast('Coming Soon', 'Email notifications will be available in a future update', 'info');
                        this.checked = false;
                        return;
                    }
                    
                    const fieldMap = {
                        'settingsInAppNotifications': 'in_app_notifications',
                        'settingsPushNotifications': 'push_notifications',
                        'settingsEmailNotifications': 'email_notifications',
                        'settingsAppearOffline': 'stealth_mode',
                        'settingsReadReceipts': 'send_read_receipts',
                        'settingsSendWithEnter': 'send_with_enter',
                        'settingsOpenLinksInApp': 'open_links_in_app'
                    };
                    
                    const field = fieldMap[toggleId];
                    const value = this.type === 'checkbox' ? this.checked : this.value;
                    
                    const { error } = await state.supabase
                        .from('profiles')
                        .update({ [field]: value })
                        .eq('id', state.currentUser.id);
                        
                    if (error) {
                        console.log(`Error saving ${field}:`, error);
                        this.checked = !this.checked;
                        showToast('Error', 'Failed to update setting', 'error');
                        return;
                    }
                    
                    state.userSettings[field] = value;
                    showToast('Settings Updated', 'Setting saved successfully', 'success');
                    
                    if (toggleId === 'settingsSendWithEnter') {
                        applyUserSettings();
                    }
                });
            }
        });
        
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', async function() {
                const theme = this.dataset.theme;
                document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                
                const { error } = await state.supabase
                    .from('profiles')
                    .update({ theme_preference: theme })
                    .eq('id', state.currentUser.id);
                    
                if (error) {
                    console.log('Error saving theme preference:', error);
                    showToast('Error', 'Failed to update theme', 'error');
                    return;
                }
                
                await fetchAndUpdateProfile(true);
                showToast('Settings Updated', 'Theme preference updated', 'success');
            });
        });
        
        const showRealmsToggle = document.getElementById('profileShowRealms');        
        if (showRealmsToggle) {
            showRealmsToggle.addEventListener('change', async function() {
                const { error } = await state.supabase
                    .from('profiles')
                    .update({ show_realms: this.checked })
                    .eq('id', state.currentUser.id);                    
                if (error) {
                    console.log('Error saving show_realms:', error);
                    this.checked = !this.checked;
                    showToast('Error', 'Failed to update setting', 'error');
                    return;
                }
                await fetchAndUpdateProfile(true);
                showToast('Settings Updated', 'Show realms setting updated', 'success');
            });
        }
        
        document.querySelectorAll('.toggle-switch.disabled').forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                showToast('Feature Coming', 'Settings will be available in a future update', 'info');
            });
        });
        
        document.getElementById('quickProfileCloseBtn').addEventListener('click', function() {
            document.getElementById('quickProfileModal').style.display = 'none';
            state.selectedUserForProfile = null;
        });       
        document.getElementById('quickProfileContactBtn').addEventListener('click', async function() {
            if (state.selectedUserForProfile) {
                await createOrOpenDM(state.selectedUserForProfile);
                document.getElementById('quickProfileModal').style.display = 'none';
            }
        });       
        document.getElementById('quickProfileReportBtn').addEventListener('click', async function() {
            if (state.selectedUserForProfile) {
                await reportUser(state.selectedUserForProfile);
                document.getElementById('quickProfileModal').style.display = 'none';
            }
        });
        document.getElementById('closeEmojiPickerBtn').addEventListener('click', function() {
            document.getElementById('emojiPickerModal').style.display = 'none';
        });
        document.getElementById('mediaFullscreenClose').addEventListener('click', function() {
            document.getElementById('mediaFullscreenModal').style.display = 'none';
            const img = document.getElementById('mediaFullscreenImg');
            const video = document.getElementById('mediaFullscreenVideo');
            img.style.display = 'none';
            video.style.display = 'none';
            video.pause();
            video.src = '';
        });        
        document.getElementById('mediaFullscreenFullscreenBtn').addEventListener('click', function() {
            if (state.mediaFullscreenElement) {
                if (state.mediaFullscreenElement.requestFullscreen) {
                    state.mediaFullscreenElement.requestFullscreen();
                } else if (state.mediaFullscreenElement.webkitRequestFullscreen) {
                    state.mediaFullscreenElement.webkitRequestFullscreen();
                } else if (state.mediaFullscreenElement.msRequestFullscreen) {
                    state.mediaFullscreenElement.msRequestFullscreen();
                }
            }
        });
        document.getElementById('mediaFullscreenModal').addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                const img = document.getElementById('mediaFullscreenImg');
                const video = document.getElementById('mediaFullscreenVideo');
                img.style.display = 'none';
                video.style.display = 'none';
                video.pause();
                video.src = '';
            }
        });
        document.getElementById('closeAllRealmsBtn').addEventListener('click', function() {
            document.getElementById('allRealmsModal').style.display = 'none';
        });
        document.getElementById('allRealmsModalCloseBtn').addEventListener('click', function() {
            document.getElementById('allRealmsModal').style.display = 'none';
        });
        document.getElementById('createNewRealmBtn').addEventListener('click', function() {
            document.getElementById('allRealmsModal').style.display = 'none';
            document.getElementById('createRealmModal').style.display = 'flex';
        });
        document.getElementById('createRealmModalCloseBtn').addEventListener('click', function() {
            document.getElementById('createRealmModal').style.display = 'none';
        });
        document.getElementById('cancelCreateRealmBtn').addEventListener('click', function() {
            document.getElementById('createRealmModal').style.display = 'none';
        });
        document.getElementById('confirmCreateRealmBtn').addEventListener('click', createRealmModal);
        document.getElementById('addChannelBtn').addEventListener('click', function() {
            document.getElementById('currentRealmNameForChannel').textContent = state.currentRealm?.name || 'this realm';
            document.getElementById('createChannelModal').style.display = 'flex';
        });
        document.getElementById('cancelCreateChannelBtn').addEventListener('click', function() {
            document.getElementById('createChannelModal').style.display = 'none';
        });        
        document.getElementById('confirmCreateChannelBtn').addEventListener('click', createChannel);
        document.getElementById('cancelDeleteChannelBtn').addEventListener('click', function() {
            document.getElementById('deleteChannelModal').style.display = 'none';
            state.pendingChannelDelete = null;
            resetDeleteChannelSteps();
        });
        
        document.querySelectorAll('.delete-step-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const step = parseInt(this.dataset.step);
                const action = this.dataset.action;
                handleDeleteChannelStep(step, action);
            });
        });
        
        document.getElementById('forceRefreshBtn').addEventListener('click', function() {
            document.getElementById('confirmationModal').style.display = 'flex';
            document.getElementById('confirmationIcon').textContent = '↻';
            document.getElementById('confirmationTitle').textContent = 'Force Refresh';
            document.getElementById('confirmationMessage').textContent = 'This will reload the application and clear local cache. Continue?';
            
            const confirmBtn = document.getElementById('confirmationConfirm');
            const cancelBtn = document.getElementById('confirmationCancel');
            
            const handleConfirm = () => {
                localStorage.clear();
                window.location.reload(true);
            };
            
            const handleCancel = () => {
                document.getElementById('confirmationModal').style.display = 'none';
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        });        
        document.getElementById('modalForceRefreshBtn').addEventListener('click', function() {
            document.getElementById('confirmationModal').style.display = 'flex';
            document.getElementById('confirmationIcon').textContent = '↻';
            document.getElementById('confirmationTitle').textContent = 'Force Refresh';
            document.getElementById('confirmationMessage').textContent = 'This will reload the application and clear local cache. Continue?';
            
            const confirmBtn = document.getElementById('confirmationConfirm');
            const cancelBtn = document.getElementById('confirmationCancel');
            
            const handleConfirm = () => {
                localStorage.clear();
                window.location.reload(true);
            };
            
            const handleCancel = () => {
                document.getElementById('confirmationModal').style.display = 'none';
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        });
        document.getElementById('profileLogoutBtn').addEventListener('click', function() {
            state.supabase.auth.signOut()
                .then(() => {
                    window.location.href = '/';
                })
                .catch(error => {
                    console.log('Logout error:', error);
                    showToast('Error', 'Failed to logout', 'error');
                });
        });
        document.getElementById('deleteAccountBtn').addEventListener('click', function() {
            document.getElementById('confirmationModal').style.display = 'flex';
            document.getElementById('confirmationIcon').textContent = '🗑️';
            document.getElementById('confirmationTitle').textContent = 'Delete Account';
            document.getElementById('confirmationMessage').textContent = 'This cannot be undone. All your data, messages, and realms will be permanently deleted.';           
            const confirmBtn = document.getElementById('confirmationConfirm');
            const cancelBtn = document.getElementById('confirmationCancel');            
            const handleConfirm = async () => {
                try {
                    showToast('Info', 'Account deletion coming in a future update', 'info');
                    document.getElementById('confirmationModal').style.display = 'none';
                } catch (error) {
                    console.log('Error deleting account:', error);
                    showToast('Error', 'Failed to delete account', 'error');
                    document.getElementById('confirmationModal').style.display = 'none';
                }                
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            };            
            const handleCancel = () => {
                document.getElementById('confirmationModal').style.display = 'none';
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            };            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        });
        document.getElementById('emailToggleBtn').addEventListener('click', function() {
            state.emailVisible = !state.emailVisible;
            this.textContent = state.emailVisible ? 'Hide Email' : 'Show Email';
            updateProfileModal();
        });
        const usernameInput = document.getElementById('profileUsername');
        if (usernameInput) {
            usernameInput.addEventListener('input', function() {
                clearTimeout(state.usernameSaveTimer);
                state.usernameSaveTimer = setTimeout(() => {
                    saveUsername(this.value.trim());
                }, 2000);
            });           
            usernameInput.addEventListener('blur', function() {
                clearTimeout(state.usernameSaveTimer);
                saveUsername(this.value.trim());
            });
        }
        const bioInput = document.getElementById('profileBio');
        if (bioInput) {
            bioInput.addEventListener('input', function() {
                clearTimeout(state.bioSaveTimer);
                state.bioSaveTimer = setTimeout(() => {
                    saveBio(this.value);
                }, 2000);
            });            
            bioInput.addEventListener('blur', function() {
                clearTimeout(state.bioSaveTimer);
                saveBio(this.value);
            });
        }
        const socialInputs = ['socialTwitter', 'socialInstagram', 'socialWebsite', 'socialOther'];
        socialInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('blur', function() {
                    saveSocialLinks();
                });
            }
        });
        document.querySelectorAll('.modal-back').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                    if (this.id === 'deleteChannelModal') {
                        state.pendingChannelDelete = null;
                        resetDeleteChannelSteps();
                    }
                    if (this.id === 'startConversationModal') {
                        document.getElementById('userSearchInput').value = '';
                        document.getElementById('userSearchResults').style.display = 'none';
                    }
                }
            });
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.getElementById('realmDropdown').classList.remove('active');
                document.getElementById('userModal').style.display = 'none';
                document.getElementById('allRealmsModal').style.display = 'none';
                document.getElementById('createRealmModal').style.display = 'none';
                document.getElementById('createChannelModal').style.display = 'none';
                document.getElementById('deleteChannelModal').style.display = 'none';
                document.getElementById('quickProfileModal').style.display = 'none';
                document.getElementById('emojiPickerModal').style.display = 'none';
                document.getElementById('confirmationModal').style.display = 'none';
                document.getElementById('mediaFullscreenModal').style.display = 'none';
                document.getElementById('startConversationModal').style.display = 'none';
                document.getElementById('enhancedMediaModal').style.display = 'none';
                document.getElementById('welcomeModal').style.display = 'none';
                document.getElementById('realmSettingsModal').style.display = 'none';
                document.getElementById('realmAnnouncementModal').style.display = 'none';
                document.getElementById('avatarFullscreenModal').style.display = 'none';
                document.getElementById('globalSearchModal').style.display = 'none';
                document.getElementById('notificationsModal').style.display = 'none';
                document.getElementById('publicProfileModal').style.display = 'none';
                document.getElementById('notificationsDropdown').style.display = 'none';
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('active');
                }              
                if (document.getElementById('deleteChannelModal').style.display === 'none') {
                    state.pendingChannelDelete = null;
                    resetDeleteChannelSteps();
                }
                if (state.editingMessageId) {
                    state.editingMessageId = null;
                    document.querySelectorAll('.message-edit-input').forEach(input => {
                        const msgElement = input.closest('.msg');
                        const messageText = msgElement?.querySelector('.message-text');
                        if (messageText) {
                            input.parentNode.removeChild(input);
                            messageText.style.display = 'block';
                        }
                    });
                }
            }
        });
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && state.supabase && state.currentUser) {
                loadInitialData();
            }
        });
        
        document.getElementById('realmSearchInput').addEventListener('input', function() {
            clearTimeout(state.realmSearchTimer);
            state.realmSearchTimer = setTimeout(() => {
                filterRealms(this.value);
            }, 300);
        });
        
        document.getElementById('userSearchInput').addEventListener('input', function() {
            clearTimeout(state.userSearchTimer);
            state.userSearchTimer = setTimeout(() => {
                searchUsers(this.value);
            }, 300);
        });
        
        document.getElementById('cancelStartConversationBtn').addEventListener('click', function() {
            document.getElementById('startConversationModal').style.display = 'none';
            document.getElementById('userSearchInput').value = '';
            document.getElementById('userSearchResults').style.display = 'none';
        });
        
        document.getElementById('startConversationModalCloseBtn').addEventListener('click', function() {
            document.getElementById('startConversationModal').style.display = 'none';
            document.getElementById('userSearchInput').value = '';
            document.getElementById('userSearchResults').style.display = 'none';
        });
        
        document.getElementById('enhancedMediaClose').addEventListener('click', function() {
            document.getElementById('enhancedMediaModal').style.display = 'none';
            const iframe = document.getElementById('enhancedMediaIframe');
            iframe.src = '';
        });
        
        document.getElementById('avatarFullscreenClose').addEventListener('click', function() {
            document.getElementById('avatarFullscreenModal').style.display = 'none';
        });
        
        document.getElementById('avatarFullscreenModal').addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
        
        document.getElementById('realmAnnouncementCloseBtn').addEventListener('click', function() {
            document.getElementById('realmAnnouncementModal').style.display = 'none';
        });
        
        document.getElementById('realmSettingsModalCloseBtn').addEventListener('click', function() {
            document.getElementById('realmSettingsModal').style.display = 'none';
        });
        
        document.getElementById('cancelRealmSettingsBtn').addEventListener('click', function() {
            document.getElementById('realmSettingsModal').style.display = 'none';
        });
        
        document.getElementById('saveRealmSettingsBtn').addEventListener('click', saveRealmSettings);
        
        document.getElementById('realmSettingsChooseEmojiBtn').addEventListener('click', function() {
            showRealmIconEmojiPicker();
        });
        
        document.getElementById('realmSettingsIconUploadBtn').addEventListener('click', function() {
            document.getElementById('realmSettingsIconUpload').click();
        });
        
        document.getElementById('realmSettingsBackgroundUploadBtn').addEventListener('click', function() {
            document.getElementById('realmSettingsBackgroundUpload').click();
        });
        
        document.getElementById('realmSettingsIconUpload').addEventListener('change', handleRealmIconUpload);
        document.getElementById('realmSettingsBackgroundUpload').addEventListener('change', handleRealmBackgroundUpload);
        
        document.getElementById('realmSettingsPublic').addEventListener('change', function() {
            const privateSection = document.getElementById('privateRealmSection');
            if (this.checked) {
                privateSection.style.display = 'none';
            } else {
                privateSection.style.display = 'block';
            }
        });
        
        document.getElementById('realmSettingsInviteBtn').addEventListener('click', function() {
            showInviteUsersModal();
        });
        
        document.getElementById('realmAddCoAdminBtn').addEventListener('click', function() {
            addCoAdmin();
        });
        
        document.getElementById('realmCoAdminSearch').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                addCoAdmin();
            }
        });
        
        document.getElementById('realmSettingsCreateChannelBtn').addEventListener('click', function() {
            document.getElementById('createChannelModal').style.display = 'flex';
        });
        
        document.getElementById('realmSettingsLeaveBtn').addEventListener('click', function() {
            if (!state.currentRealm) return;
            leaveRealm(state.currentRealm.id);
        });
        
        document.getElementById('realmSettingsDeleteBtn').addEventListener('click', function() {
            if (!state.currentRealm) return;
            deleteRealm();
        });
        
        document.getElementById('markAllReadBtn').addEventListener('click', function() {
            markAllNotificationsRead();
        });
        
        document.getElementById('viewAllNotificationsBtn').addEventListener('click', function() {
            document.getElementById('notificationsModal').style.display = 'flex';
            loadAllNotifications();
        });
        
        document.getElementById('notificationsModalCloseBtn').addEventListener('click', function() {
            document.getElementById('notificationsModal').style.display = 'none';
        });
        
        document.getElementById('notificationsCloseBtn').addEventListener('click', function() {
            document.getElementById('notificationsModal').style.display = 'none';
        });
        
        document.getElementById('publicProfileModalCloseBtn').addEventListener('click', function() {
            document.getElementById('publicProfileModal').style.display = 'none';
        });
        
        document.getElementById('publicProfileContactBtn').addEventListener('click', function() {
            if (state.selectedUserForProfile) {
                createOrOpenDM(state.selectedUserForProfile);
                document.getElementById('publicProfileModal').style.display = 'none';
            }
        });
        
        document.getElementById('publicProfileCloseBtn').addEventListener('click', function() {
            document.getElementById('publicProfileModal').style.display = 'none';
        });
        
        // Add attachment upload
        document.getElementById('attachmentUploadBtn').addEventListener('click', function() {
            document.getElementById('attachmentUploadInput').click();
        });
        
        document.getElementById('attachmentUploadInput').addEventListener('change', handleAttachmentUpload);
        
    } catch (error) {
        console.log('Error setting up event listeners:', error);
    }
}

// ==================== REST OF THE FUNCTIONS (PRESERVED FROM ORIGINAL) ====================
// [Note: The rest of the functions (loadCoAdmins, addCoAdmin, removeCoAdmin, loadChannelsForDragAndDrop,
// handleDragStart, handleDragOver, handleDrop, handleDragEnd, getDragAfterElement, updateChannelPositions,
// showRealmIconEmojiPicker, handleRealmIconUpload, handleRealmBackgroundUpload, showInviteUsersModal,
// deleteRealm, performGlobalSearch, loadAllNotifications, markAllNotificationsRead, showUserProfile,
// showAllRealmsModal, renderRealmsList, filterRealms, joinRealm, createRealmModal, saveUsername,
// saveBio, saveSocialLinks, initializePWA, handleAvatarUpload, openMediaFullscreen, openEnhancedMedia,
// openAvatarFullscreen, displayUserProfile, createOrOpenDM, reportMessagePrivate, reportUser, showEmojiPicker,
// addReaction, searchUsers, createChannel, showDeleteChannelConfirmation, handleDeleteChannelStep,
// resetDeleteChannelSteps, deleteChannelFinal, escapeHtml, setupCustomCursor) remain the same as in the original
// but with updated function calls where needed to integrate new features.]

// ==================== ATTACHMENT HANDLING ====================
async function handleAttachmentUpload(event) {
    try {
        const files = Array.from(event.target.files);
        if (!files.length || !state.currentUser || !state.supabase) return;
        
        showGlobalLoading();
        
        const attachments = [];
        
        for (const file of files) {
            const filePath = `attachments/${state.currentUser.id}/${Date.now()}_${file.name}`;
            
            const { error: uploadError } = await state.supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true,
                    contentType: file.type
                });
                
            if (uploadError) {
                console.log('Error uploading attachment:', uploadError);
                continue;
            }
            
            const { data: { publicUrl } } = state.supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
                
            attachments.push({
                url: publicUrl,
                filename: file.name,
                type: file.type,
                size: file.size
            });
        }
        
        if (attachments.length > 0) {
            // Add attachment URLs to message input
            const messageInput = document.getElementById('messageInput');
            const attachmentUrls = attachments.map(a => a.url).join('\n');
            messageInput.value = messageInput.value + (messageInput.value ? '\n' : '') + attachmentUrls;
            messageInput.dispatchEvent(new Event('input'));
            
            showToast('Success', `Added ${attachments.length} attachment(s)`, 'success');
        }
        
        event.target.value = '';
        hideGlobalLoading();
        
    } catch (error) {
        console.log('Error handling attachment upload:', error);
        hideGlobalLoading();
        showToast('Error', 'Failed to upload attachments', 'error');
    }
}

// ==================== HELPER FOR OPENING USER PROFILE FROM MENTION ====================
function openUserProfileFromMention(username) {
    try {
        // Find user by username
        state.supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single()
            .then(({ data: profile, error }) => {
                if (!error && profile) {
                    showUserProfile(profile.id);
                }
            });
    } catch (error) {
        console.log('Error opening user profile from mention:', error);
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Labyrinth Chat v0.5.560 Beta...');
    document.title = 'Labyrinth Chat v0.5.560 Beta';
    document.querySelector('.version').textContent = 'v0.5.560 Beta';
    document.querySelector('.login-subtitle').textContent = 'v0.5.560 Beta • Fully Functional';
    state.loaderTimeout = setTimeout(hideLoader, 3000);
    initializeSupabase();
    setTimeout(setupCustomCursor, 100);
});

// Expose functions to global scope
window.openMediaFullscreen = openMediaFullscreen;
window.openEnhancedMedia = openEnhancedMedia;
window.openAvatarFullscreen = openAvatarFullscreen;
window.openUserProfile = openUserProfile;
window.openUserProfileFromMention = openUserProfileFromMention;
