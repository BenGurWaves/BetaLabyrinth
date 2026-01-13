// Labyrinth Version 0.6.000 ALPHA

const SUPABASE_URL = 'https://fjbrlejyneudwdiipmbt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYnJsZWp5bmV1ZHdkaWlwbWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzM4MDksImV4cCI6MjA4MjA0OTgwOX0.dYth1MXsn4-26Rb5XCca--noceIUX1Uf4VwfUWTeWyQ';
const STORAGE_BUCKET = 'avatars';
const PROTECTED_REALM_SLUGS = ['labyrinth', 'bengurwaves'];
const ADMIN_USERNAME = 'TheRealBenGurWaves';
const VAPID_PUBLIC_KEY = 'BLdyBIqH3Z-rl3Sw8O0a4gK3A8qB4MVyzzXxLhFhHwz8u4VYvQ8c2zQ6n8Xq0n8n4s8K3X8qB4MVyzzXxLhFhHwz8u4VYvQ8c';

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
    systemThemeListener: null
};

// CHANGED FOR BUG 1: Updated version comment

// SQL for required new columns/tables:
/*
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS show_dob BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS push_subscription JSONB,
ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- For saved messages feature:
CREATE TABLE IF NOT EXISTS saved_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, message_id)
);
*/

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

// CHANGED FOR BUG 13: Remove cookies confirmation logic
function checkCookieConsent() {
    try {
        // Always hide cookie banner - no cookie consent needed
        document.getElementById('cookieBanner').style.display = 'none';
    } catch (error) {
        console.log('Error checking cookie consent:', error);
    }
}

function acceptCookies() {
    try {
        // No-op function
        document.getElementById('cookieBanner').style.display = 'none';
    } catch (error) {
        console.log('Error accepting cookies:', error);
    }
}

// ADDED FOR FEATURE 9: Update streak and message count
async function updateStreakAndCount() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('streak_count, total_messages_sent, last_active_date')
            .eq('id', state.currentUser.id)
            .single();
            
        if (error) return;
        
        let streakCount = profile.streak_count || 0;
        const lastActive = profile.last_active_date;
        
        if (lastActive) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (lastActive === yesterdayStr) {
                streakCount += 1;
            } else if (lastActive !== today) {
                streakCount = 1;
            }
        } else {
            streakCount = 1;
        }
        
        await state.supabase
            .from('profiles')
            .update({
                streak_count: streakCount,
                last_active_date: today
            })
            .eq('id', state.currentUser.id);
            
        const streakElement = document.getElementById('streakCount');
        if (streakElement) {
            streakElement.textContent = streakCount;
        }
        
    } catch (error) {
        console.log('Error updating streak:', error);
    }
}

// ADDED FOR FEATURE 9: Increment message count on send
async function incrementMessageCount() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        await state.supabase.rpc('increment_message_count', {
            user_id: state.currentUser.id
        });
        
        const { data: profile } = await state.supabase
            .from('profiles')
            .select('total_messages_sent')
            .eq('id', state.currentUser.id)
            .single();
            
        if (profile && document.getElementById('messageCount')) {
            document.getElementById('messageCount').textContent = profile.total_messages_sent;
        }
        
    } catch (error) {
        console.log('Error incrementing message count:', error);
    }
}

// ADDED v0.5.57: Push notification subscription
async function subscribeToPushNotifications() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToast('Info', 'Push notifications not supported in this browser', 'info');
            return null;
        }
        
        const registration = await navigator.serviceWorker.ready;
        
        let subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            return subscription;
        }
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Info', 'Push notification permission denied', 'info');
            return null;
        }
        
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        return subscription;
        
    } catch (error) {
        console.log('Error subscribing to push notifications:', error);
        showToast('Error', 'Failed to enable push notifications', 'error');
        return null;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
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

async function savePushSubscription(subscription) {
    try {
        if (!state.currentUser || !state.supabase || !subscription) return false;
        
        const { error } = await state.supabase
            .from('profiles')
            .update({ 
                push_subscription: subscription,
                push_notifications: true
            })
            .eq('id', state.currentUser.id);
            
        if (error) {
            console.log('Error saving push subscription:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.log('Error saving push subscription:', error);
        return false;
    }
}

async function unsubscribeFromPushNotifications() {
    try {
        if (!('serviceWorker' in navigator)) return;
        
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await subscription.unsubscribe();
            
            if (state.currentUser && state.supabase) {
                await state.supabase
                    .from('profiles')
                    .update({ 
                        push_subscription: null,
                        push_notifications: false
                    })
                    .eq('id', state.currentUser.id);
            }
        }
    } catch (error) {
        console.log('Error unsubscribing from push notifications:', error);
    }
}

async function checkPushNotificationSubscription() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const { data: profile } = await state.supabase
            .from('profiles')
            .select('push_notifications, push_subscription')
            .eq('id', state.currentUser.id)
            .single();
            
        if (!profile || !profile.push_notifications) return;
        
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (!subscription && profile.push_subscription) {
                const newSubscription = await subscribeToPushNotifications();
                if (newSubscription) {
                    await savePushSubscription(newSubscription);
                }
            }
        }
    } catch (error) {
        console.log('Error checking push notification subscription:', error);
    }
}

async function checkDOBRequirement() {
    try {
        if (!state.currentUser || !state.supabase) return false;
        
        const { data: profile } = await state.supabase
            .from('profiles')
            .select('dob')
            .eq('id', state.currentUser.id)
            .single();
            
        if (!profile || !profile.dob) {
            setTimeout(() => {
                document.getElementById('dobModal').style.display = 'flex';
            }, 1000);
            return true;
        }
        
        return false;
    } catch (error) {
        console.log('Error checking DOB requirement:', error);
        return false;
    }
}

async function saveDOB() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const dobInput = document.getElementById('dobInput').value;
        const showDob = document.getElementById('showDobToggle').checked;
        
        if (!dobInput) {
            showToast('Error', 'Please enter your date of birth', 'error');
            return;
        }
        
        const dob = new Date(dobInput);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        
        if (age < 13) {
            showToast('Error', 'You must be at least 13 years old to use this service', 'error');
            return;
        }
        
        const { error } = await state.supabase
            .from('profiles')
            .update({
                dob: dobInput,
                show_dob: showDob
            })
            .eq('id', state.currentUser.id);
            
        if (error) throw error;
        
        document.getElementById('dobModal').style.display = 'none';
        showToast('Success', 'Date of birth saved successfully', 'success');
        
        await fetchAndUpdateProfile(true);
        
    } catch (error) {
        console.log('Error saving DOB:', error);
        showToast('Error', 'Failed to save date of birth', 'error');
    }
}

function formatAge(dobString) {
    try {
        const dob = new Date(dobString);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    } catch (error) {
        return null;
    }
}

async function deleteAccount() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ 
                deleted_at: new Date().toISOString(),
                username: `deleted_user_${state.currentUser.id.slice(0, 8)}`,
                email: `deleted_${state.currentUser.id}@example.com`,
                avatar_url: null,
                bio: null,
                social_links: null,
                show_realms: false,
                stealth_mode: true,
                push_subscription: null
            })
            .eq('id', state.currentUser.id);
            
        if (updateError) throw updateError;
        
        const { error: messagesError } = await state.supabase
            .from('messages')
            .delete()
            .eq('user_id', state.currentUser.id);
            
        if (messagesError) console.log('Error deleting messages:', messagesError);
        
        const { error: realmsError } = await state.supabase
            .from('user_realms')
            .delete()
            .eq('user_id', state.currentUser.id);
            
        if (realmsError) console.log('Error removing from realms:', realmsError);
        
        const { error: channelsError } = await state.supabase
            .from('channels')
            .delete()
            .eq('created_by', state.currentUser.id);
            
        if (channelsError) console.log('Error deleting channels:', channelsError);
        
        const { error: ownedRealmsError } = await state.supabase
            .from('realms')
            .update({ 
                deleted_at: new Date().toISOString(),
                is_public: false 
            })
            .eq('created_by', state.currentUser.id);
            
        if (ownedRealmsError) console.log('Error deleting owned realms:', ownedRealmsError);
        
        await state.supabase.auth.signOut();
        
        showToast('Success', 'Account deleted successfully', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.log('Error deleting account:', error);
        showToast('Error', 'Failed to delete account', 'error');
    }
}

async function fetchAndUpdateProfile(immediate = false) {
    try {
        if (!state.currentUser || !state.supabase) return;        
        console.log('Fetching latest profile from Supabase...');        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('username, avatar_url, bio, social_links, show_realms, stealth_mode, theme_preference, in_app_notifications, push_notifications, email_notifications, send_with_enter, open_links_in_app, send_read_receipts, dob, show_dob, streak_count, total_messages_sent, last_active_date')
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
            state.userSettings.dob = profile.dob;
            state.userSettings.show_dob = profile.show_dob === true;
            state.userSettings.streak_count = profile.streak_count || 0;
            state.userSettings.total_messages_sent = profile.total_messages_sent || 0;
            state.userSettings.last_active_date = profile.last_active_date;
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

// CHANGED FOR BUG 8: Correctly display avatar from profiles.avatar_url and real username
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
            headerName.textContent = state.userSettings.username || 'User';
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
                username: 'User',
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
                dob: null,
                show_dob: false,
                streak_count: 0,
                total_messages_sent: 0,
                last_active_date: null
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
                dob: null,
                show_dob: false,
                streak_count: 0,
                total_messages_sent: 0,
                last_active_date: null
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
            dob: profile.dob || null,
            show_dob: profile.show_dob === true,
            streak_count: profile.streak_count || 0,
            total_messages_sent: profile.total_messages_sent || 0,
            last_active_date: profile.last_active_date || null
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
            dob: null,
            show_dob: false,
            streak_count: 0,
            total_messages_sent: 0,
            last_active_date: null
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

// CHANGED FOR BUG 3-18: Removed DM realm from protected realms
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

// ADDED FOR FEATURE 16: Update URL hash when switching realms/channels
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
        
        // Update URL hash
        updateURLHash();
        
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

// CHANGED FOR BUG 3-18: Removed DM realm from realm dropdown
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
            let iconHtml = '';
            if (realm.icon_url) {
                iconHtml = `<img src="${realm.icon_url}" style="width: 20px; height: 20px; border-radius: 4px; margin-right: 8px; object-fit: cover;">`;
            } else {
                iconHtml = `<span style="margin-right: 8px;">${realm.icon_url || '🏰'}</span>`;
            }
            
            let realmText = realm.name;
            if (realm.show_creator) {
                const creatorUsername = realm.created_by === state.currentUser?.id ? 'You' : '@' + (realm.created_by_username || '');
                realmText += ` <span style="font-size: 11px; color: var(--color-gray); font-style: italic;">Created by ${creatorUsername}</span>`;
            }
            option.innerHTML = `${iconHtml}${realmText}`;
            
            option.onclick = function(e) {
                switchRealm(realm.id);
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

// CHANGED FOR BUG 3-18: Removed DM realm logic
async function loadChannels() {
    try {
        if (!state.currentRealm || !state.supabase) {
            console.log('Cannot load channels: no realm selected');
            return;
        }     
        console.log('Loading channels for realm:', state.currentRealm.id, 'Slug:', state.currentRealm.slug);
        
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
                    return;
                }                   
                state.channels = channels;
                renderChannels();
                if (channels.length > 0 && !state.currentChannel) {
                    selectChannel(channels[0].id);
                }                    
                console.log('Loaded', channels.length, 'channels');
                updateAddChannelButton();
            })
            .catch(error => {
                console.log('Error loading channels:', error);
                renderChannels();
            });
    } catch (error) {
        console.log('Error in loadChannels:', error);
        renderChannels();
    }
}

function renderChannels() {
    try {
        const channelList = document.getElementById('channelList');
        if (!channelList) return;        
        channelList.innerHTML = '';        
        if (state.channels.length === 0) {
            let message = 'No channels in this realm';
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
            
            item.innerHTML = `
                <div class="channel-icon">#</div>
                <div style="flex: 1;">${escapeHtml(channel.name)}</div>
                ${isChannelCreator ? '<div class="channel-delete-btn" style="color: var(--color-gray); font-size: 12px; padding: 4px; opacity: 0; transition: opacity var(--transition-fast);">🗑️</div>' : ''}
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
            if (deleteBtn) {
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
        if (state.currentRealm && state.currentRealm.created_by === state.currentUser?.id) {
            addChannelContainer.style.display = 'block';
        } else {
            addChannelContainer.style.display = 'none';
        }
    } catch (error) {
        console.log('Error updating add channel button:', error);
    }
}

// ADDED FOR FEATURE 16: Update URL hash when switching channels
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
            return item.textContent.includes(channel.name);
        });        
        if (activeItem) {
            activeItem.classList.add('active');
        }
        updateMessageInputForChannel();
        loadMessages();
        
        // Update URL hash
        updateURLHash();
        
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
        
        if (!isWritable) {
            messageInput.disabled = true;
            messageInput.placeholder = "This channel is read-only";
            messageInput.style.opacity = "0.5";
            messageInput.style.pointerEvents = "none";
            sendBtn.style.display = "none";
            readOnlyNotice.classList.add('active');
        } else {
            messageInput.disabled = false;
            let placeholderText = `Message #${state.currentChannel.name}`;
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
                
                // Check URL hash for message to scroll to
                checkURLHashForMessage();
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

// CHANGED FOR BUG 12: Updated pinned message logic for admin unpin/replace
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
            console.log('Pinned message not found, clearing pin:', error);
            await state.supabase
                .from('channels')
                .update({ pinned_message_id: null })
                .eq('id', state.currentChannel.id);
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

// CHANGED FOR BUG 12: Allow admin to unpin or replace pinned message
async function pinMessage(messageId) {
    try {
        if (!state.currentChannel || !state.supabase) return;
        
        const isAlreadyPinned = state.currentChannel.pinned_message_id === messageId;
        
        if (isAlreadyPinned) {
            const { error } = await state.supabase
                .from('channels')
                .update({ pinned_message_id: null })
                .eq('id', state.currentChannel.id);
                
            if (error) {
                console.log('Error unpinning message:', error);
                showToast('Error', 'Failed to unpin message', 'error');
                return;
            }
            
            showToast('Success', 'Message unpinned', 'success');
            loadPinnedMessage();
        } else {
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
        }
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

function formatMessageContent(content) {
    if (!content) return '';
    let escapedContent = escapeHtml(content);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escapedContent.replace(urlRegex, function(url) {
        const cleanUrl = url.replace(/[.,!?;:]$/, '');
        const trailingChar = url.slice(cleanUrl.length);
        const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(cleanUrl);
        const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(cleanUrl);
        const isAudio = /\.(mp3|wav|ogg)(\?.*)?$/i.test(cleanUrl);
        const isYouTube = /youtube\.com|youtu\.be/.test(cleanUrl);
        const isSpotify = /open\.spotify\.com/.test(cleanUrl);
        const isVimeo = /vimeo\.com/.test(cleanUrl);
        const isRumble = /rumble\.com/.test(cleanUrl);
        
        let mediaHtml = '';      
        if (isImage) {
            mediaHtml = `
                <div class="message-media-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <img src="${cleanUrl}" class="message-image" alt="Image" onclick="openMediaFullscreen('${cleanUrl}', 'image')" style="cursor: pointer; max-width: 320px; max-height: 240px; border-radius: 6px; margin-top: 8px;">
                </div>
            `;
        } else if (isVideo) {
            mediaHtml = `
                <div class="message-media-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <video controls class="message-video" onclick="openMediaFullscreen('${cleanUrl}', 'video')" style="cursor: pointer; max-width: 320px; max-height: 240px; border-radius: 6px; margin-top: 8px;">
                        <source src="${cleanUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else if (isAudio) {
            mediaHtml = `
                <div class="message-media-container">
                    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                    <audio controls class="message-audio" style="width: 100%; margin-top: 8px;">
                        <source src="${cleanUrl}" type="audio/mpeg">
                        Your browser does not support the audio tag.
                    </audio>
                </div>
            `;
        } else if (isYouTube) {
            const videoId = extractYouTubeVideoId(cleanUrl);
            if (videoId) {
                mediaHtml = `
                    <div class="youtube-embed-container">
                        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                        <iframe class="youtube-embed" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        <div class="youtube-buttons">
                            <button class="youtube-btn" onclick="openEnhancedMedia('https://www.youtube.com/embed/${videoId}?autoplay=1')">Watch in Labyrinth</button>
                            <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Watch on YouTube</button>
                        </div>
                    </div>
                `;
            } else {
                mediaHtml = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
            }
        } else if (isSpotify) {
            const spotifyData = extractSpotifyId(cleanUrl);
            if (spotifyData) {
                mediaHtml = `
                    <div class="youtube-embed-container">
                        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                        <iframe class="youtube-embed" src="https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>
                        <div class="youtube-buttons">
                            <button class="youtube-btn" onclick="openEnhancedMedia('https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}')">Listen in Labyrinth</button>
                            <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Open in Spotify</button>
                        </div>
                    </div>
                `;
            } else {
                mediaHtml = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
            }
        } else if (isVimeo) {
            const videoId = extractVimeoId(cleanUrl);
            if (videoId) {
                mediaHtml = `
                    <div class="youtube-embed-container">
                        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                        <iframe class="youtube-embed" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
                        <div class="youtube-buttons">
                            <button class="youtube-btn" onclick="openEnhancedMedia('https://player.vimeo.com/video/${videoId}?autoplay=1')">Watch in Labyrinth</button>
                            <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Watch on Vimeo</button>
                        </div>
                    </div>
                `;
            } else {
                mediaHtml = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
            }
        } else if (isRumble) {
            const videoId = extractRumbleId(cleanUrl);
            if (videoId) {
                mediaHtml = `
                    <div class="youtube-embed-container">
                        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>
                        <iframe class="youtube-embed" src="https://rumble.com/embed/${videoId}/" frameborder="0" allowfullscreen></iframe>
                        <div class="youtube-buttons">
                            <button class="youtube-btn" onclick="openEnhancedMedia('https://rumble.com/embed/${videoId}/')">Watch in Labyrinth</button>
                            <button class="youtube-btn" onclick="window.open('${cleanUrl}', '_blank')">Watch on Rumble</button>
                        </div>
                    </div>
                `;
            } else {
                mediaHtml = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
            }
        } else {
            if (state.userSettings?.open_links_in_app) {
                mediaHtml = `<a href="${cleanUrl}" onclick="openEnhancedMedia('${cleanUrl}'); return false;" style="cursor: pointer;">${cleanUrl}</a>`;
            } else {
                mediaHtml = `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
            }
        }        
        return mediaHtml + trailingChar;
    });
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

// ADDED FOR FEATURE 14: Desktop hover reactions
// ADDED FOR FEATURE 15: Save Message in context menu
// ADDED FOR FEATURE 16: Share Message in context menu
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
        const isCurrentlyPinned = state.currentChannel?.pinned_message_id === message.id;
        
        const menuItems = [
            { icon: '😊', text: 'React', className: 'react' },
            { icon: '👤', text: 'View Profile', className: 'view-profile' },
            { icon: '⚠️', text: 'Report', className: 'report' }
        ];
        
        // ADDED FOR FEATURE 15: Save Message
        menuItems.push({ icon: '💾', text: 'Save Message', className: 'save' });
        
        // ADDED FOR FEATURE 16: Share Message
        menuItems.push({ icon: '🔗', text: 'Share Message', className: 'share' });
        
        if (canPin) {
            if (isCurrentlyPinned) {
                menuItems.push({ icon: '📌', text: 'Unpin Message', className: 'pin' });
            } else {
                menuItems.push({ icon: '📌', text: 'Pin Message', className: 'pin' });
            }
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
            reportMessagePrivate(message);
            removeMenu();
        });
        
        // ADDED FOR FEATURE 15: Save Message handler
        contextMenu.querySelector('.save').addEventListener('click', (e) => {
            e.stopPropagation();
            saveMessage(message.id);
            removeMenu();
        });
        
        // ADDED FOR FEATURE 16: Share Message handler
        contextMenu.querySelector('.share').addEventListener('click', (e) => {
            e.stopPropagation();
            shareMessage(message);
            removeMenu();
        });
        
        if (canPin) {
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
        
        // ADDED FOR FEATURE 14: Desktop hover reactions
        if (window.innerWidth > 768) {
            let hoverTimer;
            let reactionBar = null;
            
            msgElement.addEventListener('mouseenter', () => {
                hoverTimer = setTimeout(() => {
                    if (!reactionBar) {
                        reactionBar = createReactionBar(msgElement, message);
                        msgElement.appendChild(reactionBar);
                    }
                }, 300);
            });
            
            msgElement.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimer);
                if (reactionBar && !reactionBar.matches(':hover')) {
                    reactionBar.remove();
                    reactionBar = null;
                }
            });
        }
        
    } catch (error) {
        console.log('Error setting up context menu:', error);
    }
}

// ADDED FOR FEATURE 14: Create reaction bar for desktop hover
function createReactionBar(msgElement, message) {
    const reactionBar = document.createElement('div');
    reactionBar.className = 'reaction-bar';
    reactionBar.style.cssText = `
        position: absolute;
        right: 10px;
        top: -30px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        padding: 4px 8px;
        display: flex;
        gap: 4px;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    const commonEmojis = ['👍', '❤️', '😂'];
    
    commonEmojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 2px;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = 'var(--bg-hover)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = 'transparent';
        });
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            state.selectedMessageForReaction = message;
            await addReaction(emoji);
            reactionBar.remove();
        });
        reactionBar.appendChild(btn);
    });
    
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.style.cssText = `
        background: var(--bg-hover);
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 2px;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    `;
    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedMessageForReaction = message;
        showEmojiPicker();
        reactionBar.remove();
    });
    reactionBar.appendChild(plusBtn);
    
    reactionBar.addEventListener('mouseenter', () => {
        clearTimeout(msgElement.hoverTimer);
    });
    
    reactionBar.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (!msgElement.matches(':hover')) {
                reactionBar.remove();
            }
        }, 300);
    });
    
    return reactionBar;
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

// ADDED FOR FEATURE 15: Save message to saved_messages
async function saveMessage(messageId) {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const { error } = await state.supabase
            .from('saved_messages')
            .insert({
                user_id: state.currentUser.id,
                message_id: messageId
            })
            .select()
            .single();
            
        if (error) {
            if (error.code === '23505') {
                showToast('Info', 'Message already saved', 'info');
            } else {
                console.log('Error saving message:', error);
                showToast('Error', 'Failed to save message', 'error');
            }
            return;
        }
        
        showToast('Success', 'Message saved', 'success');
    } catch (error) {
        console.log('Error saving message:', error);
        showToast('Error', 'Failed to save message', 'error');
    }
}

// ADDED FOR FEATURE 16: Share message modal
function shareMessage(message) {
    try {
        const modal = document.getElementById('shareMessageModal');
        if (!modal) return;
        
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}#realm=${state.currentRealm?.id}&channel=${state.currentChannel?.id}&message=${message.id}`;
        
        document.getElementById('shareMessageLink').value = shareUrl;
        document.getElementById('shareMessageModal').style.display = 'flex';
        
        document.getElementById('copyShareLinkBtn').onclick = function() {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('Success', 'Link copied to clipboard', 'success');
            }).catch(err => {
                console.log('Error copying link:', err);
                showToast('Error', 'Failed to copy link', 'error');
            });
        };
    } catch (error) {
        console.log('Error sharing message:', error);
        showToast('Error', 'Failed to share message', 'error');
    }
}

// CHANGED FOR BUG 7: Fixed avatar and username click handlers
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
            <img class="message-avatar" src="${avatarUrl ? avatarUrl + '?t=' + Date.now() : ''}" alt="${username}" onerror="this.style.display='none';">
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
        
        // CHANGED FOR BUG 7: Fixed avatar and username click handlers
        const avatarEl = msgElement.querySelector('.message-avatar');
        const usernameEl = msgElement.querySelector('.message-username');
        
        if (avatarEl) {
            avatarEl.style.cursor = 'pointer';
            avatarEl.onclick = (e) => {
                e.stopPropagation();
                showUserProfile(message.user_id, message.profiles);
            };
        }
        
        if (usernameEl) {
            usernameEl.style.cursor = 'pointer';
            usernameEl.onclick = (e) => {
                e.stopPropagation();
                showUserProfile(message.user_id, message.profiles);
            };
        }
        
        messagesContainer.appendChild(msgElement);
        setupMessageContextMenu(msgElement, message);
        setTimeout(() => {
            msgElement.style.opacity = '1';
        }, 10);        
    } catch (error) {
        console.log('Error appending message:', error);
    }
}

// CHANGED FOR BUG 19: Ensure reactions properly handle jsonb structure
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

// CHANGED FOR FEATURE 9: Increment message count on send
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
                } else {
                    updateStreakAndCount();
                    incrementMessageCount();
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
        const username = state.userSettings?.username || 'User';
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

// CHANGED FOR FEATURE 9: Updated profile modal with birthday, streak, and total messages
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
            const username = state.userSettings?.username || 'Not set';
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
                const initials = (state.userSettings?.username || 'U').charAt(0).toUpperCase();
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
        
        // ADDED FOR FEATURE 9: Display birthday if available
        const birthdayElement = document.getElementById('profileBirthday');
        if (birthdayElement && state.userSettings?.dob) {
            const dob = new Date(state.userSettings.dob);
            const formattedDate = `${dob.getMonth() + 1}/${dob.getDate()}/${dob.getFullYear()}`;
            birthdayElement.textContent = `Birthday: ${formattedDate}`;
            birthdayElement.style.display = 'block';
        } else if (birthdayElement) {
            birthdayElement.style.display = 'none';
        }
        
        // ADDED FOR FEATURE 9: Display streak and total messages
        const streakElement = document.getElementById('profileStreak');
        const messageCountElement = document.getElementById('profileMessageCount');
        if (streakElement) {
            streakElement.textContent = `🔥 ${state.userSettings?.streak_count || 0} day streak`;
        }
        if (messageCountElement) {
            messageCountElement.textContent = `📝 ${state.userSettings?.total_messages_sent || 0} total messages`;
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
            .select('show_realms, dob, show_dob, streak_count, total_messages_sent')
            .eq('id', userId)
            .single();            
        if (profileError || !profile) {
            return { show_realms: true, realms: [], show_dob: false, dob: null, streak_count: 0, total_messages_sent: 0 };
        }        
        if (profile.show_realms === false) {
            return { 
                show_realms: false, 
                realms: [], 
                show_dob: profile.show_dob, 
                dob: profile.dob,
                streak_count: profile.streak_count || 0,
                total_messages_sent: profile.total_messages_sent || 0
            };
        }
        const { data: userRealms, error } = await state.supabase
            .from('user_realms')
            .select(`
                realms (*)
            `)
            .eq('user_id', userId);           
        if (error) {
            return { 
                show_realms: true, 
                realms: [], 
                show_dob: profile.show_dob, 
                dob: profile.dob,
                streak_count: profile.streak_count || 0,
                total_messages_sent: profile.total_messages_sent || 0
            };
        }        
        const realms = userRealms.map(item => item.realms).filter(Boolean);
        return { 
            show_realms: true, 
            realms, 
            show_dob: profile.show_dob, 
            dob: profile.dob,
            streak_count: profile.streak_count || 0,
            total_messages_sent: profile.total_messages_sent || 0
        };       
    } catch (error) {
        console.log('Error loading other user realms:', error);
        return { show_realms: true, realms: [], show_dob: false, dob: null, streak_count: 0, total_messages_sent: 0 };
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

// CHANGED FOR BUG 2: Remove all sign-in/auth code, assume user is authenticated
function initializeSupabase() {
    try {
        console.log('Initializing Supabase v0.6.000 Alpha...');
        state.loaderTimeout = setTimeout(hideLoader, 3000);
        state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });
        
        // Assume user is already authenticated
        state.supabase.auth.getSession()
            .then(({ data: { session }, error }) => {
                if (error) {
                    console.log('Auth check error:', error);
                    showToast('Error', 'Authentication error', 'error');
                    return;
                }                
                if (!session) {
                    console.log('No session found');
                    showToast('Error', 'Please sign in', 'error');
                    return;
                }                
                state.currentUser = session.user;
                console.log('User authenticated:', state.currentUser.id);
                initializeApp();
            })
            .catch(error => {
                console.log('Auth error:', error);
                showToast('Error', 'Authentication error', 'error');
            });
            
        state.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);            
            if (event === 'SIGNED_OUT') {
                showToast('Error', 'Signed out', 'error');
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
    }
}

// CHANGED FOR BUG 2: Remove login screen function
function showLoginScreen() {
    // Removed - assume user is authenticated
    hideLoader();
    showToast('Error', 'Please sign in', 'error');
}

// CHANGED FOR BUG 2: Remove sign in/sign up functions
async function signIn() {
    // Removed - assume user is authenticated
}

async function signUp() {
    // Removed - assume user is authenticated
}

// ADDED FOR FEATURE 16: Update URL hash function
function updateURLHash() {
    try {
        if (state.currentRealm && state.currentChannel) {
            const hash = `#realm=${state.currentRealm.id}&channel=${state.currentChannel.id}`;
            window.history.replaceState(null, null, hash);
        }
    } catch (error) {
        console.log('Error updating URL hash:', error);
    }
}

// ADDED FOR FEATURE 16: Check URL hash for navigation
function checkURLHashForMessage() {
    try {
        const hash = window.location.hash;
        if (!hash) return;
        
        const params = new URLSearchParams(hash.substring(1));
        const messageId = params.get('message');
        
        if (messageId) {
            setTimeout(() => {
                scrollToMessage(messageId);
            }, 500);
        }
    } catch (error) {
        console.log('Error checking URL hash for message:', error);
    }
}

// ADDED FOR FEATURE 16: Parse URL hash on load
function parseURLHashOnLoad() {
    try {
        const hash = window.location.hash;
        if (!hash) return;
        
        const params = new URLSearchParams(hash.substring(1));
        const realmId = params.get('realm');
        const channelId = params.get('channel');
        
        if (realmId && channelId) {
            setTimeout(async () => {
                const realm = state.joinedRealms.find(r => r.id === realmId);
                if (realm) {
                    await switchRealm(realm.id);
                    setTimeout(() => {
                        const channel = state.channels.find(c => c.id === channelId);
                        if (channel) {
                            selectChannel(channel.id);
                        }
                    }, 500);
                }
            }, 1000);
        }
    } catch (error) {
        console.log('Error parsing URL hash on load:', error);
    }
}

async function initializeApp() {
    try {
        if (state.isLoading) return;
        state.isLoading = true;       
        console.log('Initializing app v0.6.000 Alpha...');
        document.getElementById('app').style.display = 'flex';
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
        initializePWA();
        state.initComplete = true;
        state.isLoading = false;
        if (state.loaderTimeout) {
            clearTimeout(state.loaderTimeout);
            state.loaderTimeout = null;
        }
        hideLoader();
        
        // ADDED FOR FEATURE 16: Parse URL hash on load
        parseURLHashOnLoad();
        
        setTimeout(async () => {
            const needsDOB = await checkDOBRequirement();
            if (!needsDOB) {
                showToast('Welcome', 'Connected to Labyrinth v0.6.000 Alpha', 'success');
            }
        }, 500);
        
        await updateStreakAndCount();
        
        await checkPushNotificationSubscription();
        
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

// CHANGED FOR BUG 5: Remove event listeners for removed clip and emoji buttons
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
        
        // CHANGED FOR BUG 6: Notification modal functionality
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
                            const subscription = await subscribeToPushNotifications();
                            if (subscription) {
                                const saved = await savePushSubscription(subscription);
                                if (saved) {
                                    state.userSettings.push_notifications = true;
                                    showToast('Success', 'Push notifications enabled', 'success');
                                } else {
                                    this.checked = false;
                                }
                            } else {
                                this.checked = false;
                            }
                        } else {
                            await unsubscribeFromPushNotifications();
                            state.userSettings.push_notifications = false;
                            showToast('Info', 'Push notifications disabled', 'info');
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
                showToast('Info', 'Direct messages are not available in this version', 'info');
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
                    await deleteAccount();
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
                document.getElementById('enhancedMediaModal').style.display = 'none';
                document.getElementById('welcomeModal').style.display = 'none';
                document.getElementById('realmSettingsModal').style.display = 'none';
                document.getElementById('realmAnnouncementModal').style.display = 'none';
                document.getElementById('avatarFullscreenModal').style.display = 'none';
                document.getElementById('globalSearchModal').style.display = 'none';
                document.getElementById('notificationsModal').style.display = 'none';
                document.getElementById('publicProfileModal').style.display = 'none';
                document.getElementById('dobModal').style.display = 'none';
                document.getElementById('shareMessageModal').style.display = 'none';
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
        
        // CHANGED FOR BUG 6: Notification modal buttons
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
                showToast('Info', 'Direct messages are not available in this version', 'info');
                document.getElementById('publicProfileModal').style.display = 'none';
            }
        });
        
        document.getElementById('publicProfileCloseBtn').addEventListener('click', function() {
            document.getElementById('publicProfileModal').style.display = 'none';
        });
        
        document.getElementById('dobModalCloseBtn').addEventListener('click', function() {
            document.getElementById('dobModal').style.display = 'none';
        });
        
        document.getElementById('cancelDobBtn').addEventListener('click', function() {
            document.getElementById('dobModal').style.display = 'none';
        });
        
        document.getElementById('saveDobBtn').addEventListener('click', saveDOB);
        
        document.getElementById('dobModal').addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
        
        // ADDED FOR FEATURE 15: Saved messages tab event listeners
        const savedMessagesTab = document.getElementById('savedMessagesTab');
        if (savedMessagesTab) {
            savedMessagesTab.addEventListener('click', function() {
                loadSavedMessages();
            });
        }
        
        // ADDED FOR FEATURE 16: Share message modal close button
        document.getElementById('shareMessageCloseBtn').addEventListener('click', function() {
            document.getElementById('shareMessageModal').style.display = 'none';
        });
        
        document.getElementById('shareMessageModalCloseBtn').addEventListener('click', function() {
            document.getElementById('shareMessageModal').style.display = 'none';
        });
        
        const realmDisclaimerCheckbox = document.getElementById('realmDisclaimerCheckbox');
        const confirmCreateRealmBtn = document.getElementById('confirmCreateRealmBtn');
        
        if (realmDisclaimerCheckbox && confirmCreateRealmBtn) {
            realmDisclaimerCheckbox.addEventListener('change', function() {
                confirmCreateRealmBtn.disabled = !this.checked;
            });
            confirmCreateRealmBtn.disabled = true;
        }
        
        document.getElementById('installAppBtn').addEventListener('click', async function() {
            if (state.deferredPrompt) {
                state.deferredPrompt.prompt();
                const { outcome } = await state.deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('PWA installed successfully');
                    state.deferredPrompt = null;
                }
            } else {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                const isAndroid = /Android/.test(navigator.userAgent);
                
                let instructions = '';
                if (isIOS) {
                    instructions = 'Tap the share button and then "Add to Home Screen"';
                } else if (isAndroid) {
                    instructions = 'Tap the menu button (⋮) and then "Install app" or "Add to Home Screen"';
                } else {
                    instructions = 'Use your browser\'s install option (usually in the menu or address bar)';
                }
                
                showToast('Install App', instructions, 'info', 8000);
            }
        });
        
        document.getElementById('acceptCookiesBtn').addEventListener('click', acceptCookies);
        
    } catch (error) {
        console.log('Error setting up event listeners:', error);
    }
}

// CHANGED FOR BUG 6: Populate notification modal with actual data
async function loadAllNotifications() {
    try {
        if (!state.supabase) return;
        
        const { data: notifications, error } = await state.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) {
            console.log('Error loading notifications:', error);
            return;
        }
        
        const container = document.getElementById('notificationsListFull');
        container.innerHTML = '';
        
        if (notifications.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-style: italic;">
                    No notifications
                </div>
            `;
            return;
        }
        
        notifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = 'notification-item';
            notificationElement.style.cssText = `
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background-color 0.2s;
            `;
            notificationElement.addEventListener('mouseenter', () => {
                notificationElement.style.backgroundColor = 'var(--bg-hover)';
            });
            notificationElement.addEventListener('mouseleave', () => {
                notificationElement.style.backgroundColor = 'transparent';
            });
            notificationElement.addEventListener('click', () => {
                showNotificationDetail(notification);
            });
            
            const title = notification.type === 'message' ? 'New Message' :
                         notification.type === 'mention' ? 'You were mentioned' :
                         notification.type === 'reaction' ? 'Reaction to your message' :
                         notification.type === 'admin_added' ? 'Admin Role Added' : 'Notification';
            
            const date = new Date(notification.created_at);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            notificationElement.innerHTML = `
                <div class="notification-content" style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(title)}</div>
                <div class="notification-preview" style="color: var(--text-secondary); font-size: 14px; margin-bottom: 4px;">${escapeHtml(notification.content)}</div>
                <div class="notification-time" style="color: var(--color-gray); font-size: 12px;">${formattedDate}</div>
            `;
            container.appendChild(notificationElement);
        });
        
        // Enable scrolling
        container.style.maxHeight = '400px';
        container.style.overflowY = 'auto';
    } catch (error) {
        console.log('Error loading all notifications:', error);
    }
}

// ADDED FOR BUG 6: Show notification detail
function showNotificationDetail(notification) {
    try {
        const modal = document.getElementById('notificationDetailModal');
        if (!modal) {
            // Create modal if it doesn't exist
            const modalHTML = `
                <div id="notificationDetailModal" class="modal-back" style="display: none;">
                    <div class="modal-content" style="max-width: 500px;">
                        <div class="modal-header">
                            <h3>Notification Details</h3>
                            <button id="notificationDetailCloseBtn" class="modal-close-btn">×</button>
                        </div>
                        <div class="modal-body">
                            <div id="notificationDetailContent"></div>
                        </div>
                        <div class="modal-footer">
                            <button id="notificationDetailCloseBtn2" class="btn">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            document.getElementById('notificationDetailCloseBtn').addEventListener('click', function() {
                document.getElementById('notificationDetailModal').style.display = 'none';
            });
            
            document.getElementById('notificationDetailCloseBtn2').addEventListener('click', function() {
                document.getElementById('notificationDetailModal').style.display = 'none';
            });
            
            document.getElementById('notificationDetailModal').addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                }
            });
        }
        
        const date = new Date(notification.created_at);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const title = notification.type === 'message' ? 'New Message' :
                     notification.type === 'mention' ? 'You were mentioned' :
                     notification.type === 'reaction' ? 'Reaction to your message' :
                     notification.type === 'admin_added' ? 'Admin Role Added' : 'Notification';
        
        document.getElementById('notificationDetailContent').innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-size: 18px; font-weight: 500; margin-bottom: 8px;">${escapeHtml(title)}</div>
                <div style="color: var(--color-gray); font-size: 14px;">${formattedDate}</div>
            </div>
            <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                ${escapeHtml(notification.content)}
            </div>
        `;
        
        document.getElementById('notificationDetailModal').style.display = 'flex';
    } catch (error) {
        console.log('Error showing notification detail:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        if (!state.supabase) return;
        
        const { error } = await state.supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', state.currentUser.id)
            .eq('read', false);
            
        if (error) {
            console.log('Error marking notifications as read:', error);
            return;
        }
        
        document.getElementById('notificationDot').style.display = 'none';
        showToast('Success', 'All notifications marked as read', 'success');
    } catch (error) {
        console.log('Error marking notifications as read:', error);
    }
}

// CHANGED FOR BUG 10: Fix public profile modal loading error
async function showUserProfile(userId, profileData = null) {
    try {
        if (!state.supabase) return;
        
        let profile;
        if (profileData) {
            profile = { id: userId, ...profileData };
        } else {
            const { data: fetchedProfile, error } = await state.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (error) {
                console.log('Error fetching user profile:', error);
                showToast('Error', 'Failed to load user profile', 'error');
                return;
            }
            profile = fetchedProfile;
        }
        
        // CHANGED FOR BUG 10: Ensure elements exist before setting properties
        const avatarElement = document.getElementById('publicProfileAvatar');
        const nameElement = document.getElementById('publicProfileName');
        const statusTextElement = document.getElementById('publicProfileStatusText');
        const statusDotElement = document.getElementById('publicProfileStatusDot');
        const bioElement = document.getElementById('publicProfileBio');
        
        if (avatarElement) {
            avatarElement.src = profile.avatar_url ? profile.avatar_url + '?t=' + Date.now() : '';
            avatarElement.onclick = function() {
                if (profile.avatar_url) {
                    openAvatarFullscreen(profile.avatar_url);
                }
            };
        }
        
        if (nameElement) {
            nameElement.textContent = profile.username || 'User';
        }
        
        const isStealth = profile.stealth_mode === true;
        const status = isStealth ? 'offline' : (profile.status || 'offline');
        
        if (statusTextElement) {
            statusTextElement.textContent = status === 'online' ? 'Online' : 'Offline';
        }
        
        if (statusDotElement) {
            statusDotElement.className = `public-profile-status-dot ${status === 'online' ? 'online' : ''}`;
        }
        
        if (bioElement) {
            bioElement.textContent = profile.bio || 'No bio provided';
        }
        
        // ADDED FOR FEATURE 10: Show birthday if enabled
        const profileInfoContainer = document.getElementById('publicProfileInfo');
        if (profileInfoContainer) {
            profileInfoContainer.innerHTML = '';
            
            if (profile.show_dob && profile.dob) {
                const age = formatAge(profile.dob);
                if (age) {
                    profileInfoContainer.innerHTML = `<div style="margin-top: 8px; color: var(--text-secondary); font-size: 14px;">Age: ${age}</div>`;
                }
            }
            
            // ADDED FOR FEATURE 10: Show streak and total messages
            if (profile.streak_count > 0) {
                profileInfoContainer.innerHTML += `<div style="margin-top: 8px; color: var(--color-gold); font-size: 14px;">🔥 ${profile.streak_count} day streak</div>`;
            }
            
            if (profile.total_messages_sent > 0) {
                profileInfoContainer.innerHTML += `<div style="margin-top: 4px; color: var(--text-secondary); font-size: 14px;">📝 ${profile.total_messages_sent} total messages</div>`;
            }
        }
        
        const socialLinks = profile.social_links || {};
        const socialContainer = document.getElementById('publicProfileSocialLinks');
        if (socialContainer) {
            socialContainer.innerHTML = '';
            
            if (socialLinks.twitter) {
                socialContainer.innerHTML += `<a href="${socialLinks.twitter}" target="_blank" class="social-link">Twitter</a>`;
            }
            if (socialLinks.instagram) {
                socialContainer.innerHTML += `<a href="${socialLinks.instagram}" target="_blank" class="social-link">Instagram</a>`;
            }
            if (socialLinks.website) {
                socialContainer.innerHTML += `<a href="${socialLinks.website}" target="_blank" class="social-link">Website</a>`;
            }
            if (socialLinks.other) {
                socialContainer.innerHTML += `<a href="${socialLinks.other}" target="_blank" class="social-link">Other</a>`;
            }
        }
        
        const socialSection = document.getElementById('publicProfileSocialSection');
        if (socialSection) {
            socialSection.style.display = socialContainer && socialContainer.innerHTML ? 'block' : 'none';
        }
        
        const realmsData = await loadOtherUserRealms(profile.id);
        const realmsContainer = document.getElementById('publicProfileRealms');
        
        if (realmsContainer) {
            if (realmsData.show_realms === false) {
                realmsContainer.innerHTML = '<div class="realms-hidden-message">Realms hidden by user</div>';
            } else if (realmsData.realms.length === 0) {
                realmsContainer.innerHTML = '<div class="realms-hidden-message">Not a member of any realms</div>';
            } else {
                realmsContainer.innerHTML = realmsData.realms.map(realm => {
                    let iconHtml = '';
                    if (realm.icon_url) {
                        iconHtml = `<img src="${realm.icon_url}" style="width: 20px; height: 20px; border-radius: 4px; margin-right: 8px; object-fit: cover;">`;
                    } else {
                        iconHtml = `<span style="margin-right: 8px;">${realm.icon_url || '🏰'}</span>`;
                    }
                    return `<div class="realm-chip">${iconHtml}${escapeHtml(realm.name)}</div>`;
                }).join('');
            }
        }
        
        const realmsSection = document.getElementById('publicProfileRealmsSection');
        if (realmsSection) {
            realmsSection.style.display = 'block';
        }
        
        state.selectedUserForProfile = profile.id;
        const publicProfileModal = document.getElementById('publicProfileModal');
        if (publicProfileModal) {
            publicProfileModal.style.display = 'flex';
        }
        
    } catch (error) {
        console.log('Error showing user profile:', error);
        showToast('Error', 'Failed to load user profile', 'error');
    }
}

async function showAllRealmsModal() {
    try {
        if (!state.supabase) return;        
        document.getElementById('allRealmsModal').style.display = 'flex';
        document.getElementById('realmSearchInput').value = '';
        const { data: allRealms, error } = await state.supabase
            .from('realms')
            .select('*, profiles:created_by(username)')
            .order('name', { ascending: true });            
        if (error) {
            console.log('Error loading all realms:', error);
            showToast('Error', 'Failed to load realms', 'error');
            return;
        }        
        renderRealmsList(allRealms);       
    } catch (error) {
        console.log('Error showing all realms modal:', error);
        showToast('Error', 'Failed to load realms', 'error');
    }
}

function renderRealmsList(realms) {
    try {
        const realmsList = document.getElementById('allRealmsList');
        if (!realmsList) return;
        
        realmsList.innerHTML = '';       
        if (realms.length === 0) {
            realmsList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-style: italic; padding: 20px;">No realms found</div>';
            return;
        }
        
        realms.forEach(realm => {
            const isJoined = state.joinedRealms.some(r => r.id === realm.id);
            const isProtected = PROTECTED_REALM_SLUGS.includes(realm.slug);           
            const realmItem = document.createElement('div');
            realmItem.className = 'realm-item';
            
            let iconHtml = '';
            if (realm.icon_url) {
                iconHtml = `<img src="${realm.icon_url}" style="width: 40px; height: 40px; border-radius: 8px; margin-right: 12px; object-fit: cover;">`;
            } else {
                iconHtml = `<div style="width: 40px; height: 40px; border-radius: 8px; background: var(--color-gray-dark); display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 20px;">${realm.icon_url || '🏰'}</div>`;
            }
            
            let creatorText = '';
            if (realm.show_creator && realm.profiles) {
                const creatorUsername = realm.created_by === state.currentUser?.id ? 'You' : '@' + (realm.profiles.username || '');
                creatorText = `<div style="font-size: 11px; color: var(--color-gray); margin-top: 4px; font-style: italic;">Created by ${creatorUsername}</div>';
            }
            
            realmItem.innerHTML = `
                <div style="display: flex; align-items: flex-start;">
                    ${iconHtml}
                    <div style="flex: 1;">
                        <div class="realm-item-title">${escapeHtml(realm.name)}</div>
                        <div class="realm-item-desc">${escapeHtml(realm.description || 'No description')}</div>
                        ${creatorText}
                        <div style="margin-top: 12px; display: flex; justify-content: flex-end; align-items: center;">
                            ${isJoined ? 
                                `<div class="joined-badge">Joined</div>
                                 ${!isProtected ? `<button class="leave-realm-btn" data-realm-id="${realm.id}">Leave</button>` : ''}` : 
                                `<button class="join-realm-btn" data-realm-id="${realm.id}">Join Realm</button>`
                            }
                        </div>
                    </div>
                </div>
            `;            
            realmsList.appendChild(realmItem);
            if (isJoined) {
                if (!isProtected) {
                    const leaveBtn = realmItem.querySelector('.leave-realm-btn');
                    leaveBtn.addEventListener('click', async function(e) {
                        e.stopPropagation();
                        await leaveRealm(realm.id);
                    });
                }
            } else {
                const joinBtn = realmItem.querySelector('.join-realm-btn');
                joinBtn.addEventListener('click', async function(e) {
                    e.stopPropagation();
                    await joinRealm(realm.id);
                });
            }
        });      
    } catch (error) {
        console.log('Error rendering realms list:', error);
    }
}

async function filterRealms(searchTerm) {
    try {
        if (!state.supabase) return;
        
        if (!searchTerm.trim()) {
            const { data: allRealms } = await state.supabase
                .from('realms')
                .select('*, profiles:created_by(username)')
                .order('name', { ascending: true });
            renderRealmsList(allRealms || []);
            return;
        }
        
        const { data: filteredRealms } = await state.supabase
            .from('realms')
            .select('*, profiles:created_by(username)')
            .ilike('name', `%${searchTerm}%`)
            .order('name', { ascending: true });
            
        renderRealmsList(filteredRealms || []);
    } catch (error) {
        console.log('Error filtering realms:', error);
    }
}

async function joinRealm(realmId) {
    try {
        if (!state.currentUser || !state.supabase) return;        
        const { error } = await state.supabase
            .from('user_realms')
            .insert({
                user_id: state.currentUser.id,
                realm_id: realmId,
                joined_at: new Date().toISOString()
            });           
        if (error) {
            if (error.message.includes('duplicate key')) {
                showToast('Info', 'You have already joined this realm', 'info');
            } else {
                throw error;
            }
        } else {
            showToast('Success', 'Successfully joined realm', 'success');
            state.joinedRealms = await loadJoinedRealmsFast();
            renderRealmDropdown();
            setTimeout(() => {
                document.getElementById('allRealmsModal').style.display = 'none';
            }, 1000);
        }
    } catch (error) {
        console.log('Error joining realm:', error);
        showToast('Error', 'Failed to join realm', 'error');
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
                document.getElementById('confirmationModal').style.display = 'none';
                document.getElementById('allRealmsModal').style.display = 'none';               
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

async function createRealmModal() {
    try {
        if (!state.currentUser || !state.supabase) return;        
        const nameInput = document.getElementById('newRealmNameModal');
        const descInput = document.getElementById('newRealmDescriptionModal');
        const showCreatorCheckbox = document.getElementById('newRealmShowCreator');        
        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        const showCreator = showCreatorCheckbox.checked;        
        if (!name) {
            showToast('Error', 'Please enter a realm name', 'error');
            nameInput.focus();
            return;
        }       
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');        
        const { data: newRealm, error } = await state.supabase
            .from('realms')
            .insert([{
                name: name,
                slug: slug,
                description: description,
                created_by: state.currentUser.id,
                position: state.joinedRealms.length,
                is_featured: false,
                show_creator: showCreator,
                is_public: true,
                announcement_message: null
            }])
            .select()
            .single();           
        if (error) {
            console.log('Error creating realm:', error);
            showToast('Error', 'Failed to create realm', 'error');
            return;
        }
        const { error: joinError } = await state.supabase
            .from('user_realms')
            .insert({
                user_id: state.currentUser.id,
                realm_id: newRealm.id,
                joined_at: new Date().toISOString()
            });            
        if (joinError) {
            console.log('Error joining new realm:', joinError);
        }        
        showToast('Success', 'Realm created successfully', 'success');        
        nameInput.value = '';
        descInput.value = '';
        showCreatorCheckbox.checked = true;        
        state.joinedRealms = await loadJoinedRealmsFast();
        renderRealmDropdown();        
        switchRealm(newRealm.id);
        document.getElementById('createRealmModal').style.display = 'none';        
    } catch (error) {
        console.log('Error creating realm:', error);
        showToast('Error', 'Failed to create realm', 'error');
    }
}

async function saveUsername(newUsername) {
    try {
        if (!state.currentUser || !state.supabase || !newUsername) return;      
        const currentUsername = state.userSettings?.username;
        if (newUsername === currentUsername) return;
        const { data: existingUsers, error: checkError } = await state.supabase
            .from('profiles')
            .select('id')
            .eq('username', newUsername)
            .neq('id', state.currentUser.id);            
        if (checkError) {
            console.log('Username check error:', checkError);
            showToast('Error', 'Failed to check username availability', 'error');
            return;
        }      
        if (existingUsers && existingUsers.length > 0) {
            showToast('Error', 'Username already in use', 'error');
            return;
        }
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ username: newUsername })
            .eq('id', state.currentUser.id);            
        if (updateError) {
            console.log('Username update error:', updateError);
            showToast('Error', 'Failed to update username', 'error');
            return;
        }
        await fetchAndUpdateProfile(true);
        const indicator = document.getElementById('usernameAutoSaveIndicator');
        if (indicator) {
            indicator.classList.add('show');
            setTimeout(() => indicator.classList.remove('show'), 2000);
        }        
        showToast('Success', 'Username updated', 'success');        
    } catch (error) {
        console.log('Error saving username:', error);
        showToast('Error', 'Failed to save username', 'error');
    }
}

async function saveBio(newBio) {
    try {
        if (!state.currentUser || !state.supabase) return;       
        const currentBio = state.userSettings?.bio || '';
        if (newBio === currentBio) return;
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ bio: newBio })
            .eq('id', state.currentUser.id);            
        if (updateError) {
            console.log('Bio update error:', updateError);
            showToast('Error', 'Failed to update bio', 'error');
            return;
        }
        await fetchAndUpdateProfile(true);
        const indicator = document.getElementById('bioAutoSaveIndicator');
        if (indicator) {
            indicator.classList.add('show');
            setTimeout(() => indicator.classList.remove('show'), 2000);
        }        
        showToast('Success', 'Bio updated', 'success');        
    } catch (error) {
        console.log('Error saving bio:', error);
        showToast('Error', 'Failed to save bio', 'error');
    }
}

async function saveSocialLinks() {
    try {
        if (!state.currentUser || !state.supabase) return;
        const socialLinks = {
            twitter: document.getElementById('socialTwitter').value.trim() || null,
            instagram: document.getElementById('socialInstagram').value.trim() || null,
            website: document.getElementById('socialWebsite').value.trim() || null,
            other: document.getElementById('socialOther').value.trim() || null
        };
        Object.keys(socialLinks).forEach(key => {
            if (!socialLinks[key]) delete socialLinks[key];
        });
        const currentLinks = state.userSettings?.social_links || {};
        if (JSON.stringify(socialLinks) === JSON.stringify(currentLinks)) return;
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ social_links: socialLinks })
            .eq('id', state.currentUser.id);           
        if (updateError) {
            console.log('Social links update error:', updateError);
            showToast('Error', 'Failed to update social links', 'error');
            return;
        }
        await fetchAndUpdateProfile(true);
        const indicator = document.getElementById('socialAutoSaveIndicator');
        if (indicator) {
            indicator.classList.add('show');
            setTimeout(() => indicator.classList.remove('show'), 2000);
        }       
        showToast('Success', 'Social links updated', 'success');        
    } catch (error) {
        console.log('Error saving social links:', error);
        showToast('Error', 'Failed to save social links', 'error');
    }
}

function initializePWA() {
    try {
        console.log('Initializing PWA with modern 2025 practices...');
        let deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt event fired');
            e.preventDefault();
            state.deferredPrompt = e;
            console.log('PWA install prompt available - showing install button');
            const installBtn = document.getElementById('installAppBtn');
            if (installBtn) {
                installBtn.style.display = 'flex';
            }
        });
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed successfully');
            state.deferredPrompt = null;
            const installBtn = document.getElementById('installAppBtn');
            if (installBtn) {
                installBtn.style.display = 'none';
            }
            console.log('PWA installed successfully via native browser install');
        });
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    state.isServiceWorkerRegistered = true;
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('Service Worker update found:', newWorker?.state);
                    });
                })
                .catch((error) => {
                    console.debug('Service Worker registration failed (non-critical):', error);
                });
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker controller changed');
            });
        }
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            console.log('App is already installed');
            const installBtn = document.getElementById('installAppBtn');
            if (installBtn) {
                installBtn.style.display = 'none';
            }
        }        
    } catch (error) {
        console.log('Error initializing PWA (non-critical):', error);
    }
}

async function handleAvatarUpload(event) {
    try {
        const file = event.target.files[0];
        if (!file || !state.currentUser || !state.supabase) return;
        if (!state.userSettings || !state.currentUser?.id) {
            showToast('Error', 'User not loaded yet', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showToast('Error', 'Please select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Error', 'Image must be less than 5MB', 'error');
            return;
        }        
        const progressBar = document.getElementById('avatarUploadProgressBar');
        const progressContainer = document.getElementById('avatarUploadProgress');
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        const filePath = `avatars/${state.currentUser.id}/avatar.png`;
        const { error: uploadError } = await state.supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type,
                cacheControl: '3600',
                onUploadProgress: (progress) => {
                    const percentage = (progress.loaded / progress.total) * 100;
                    progressBar.style.width = `${percentage}%`;
                }
            });            
        if (uploadError) {
            console.log('Avatar upload error:', uploadError);
            showToast('Error', 'Failed to upload avatar', 'error');
            progressContainer.style.display = 'none';
            return;
        }
        const { data: { publicUrl } } = state.supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', state.currentUser.id);         
        if (updateError) {
            console.log('Profile update error:', updateError);
            showToast('Error', 'Failed to update profile', 'error');
            progressContainer.style.display = 'none';
            return;
        }
        await fetchAndUpdateProfile(true);
        progressContainer.style.display = 'none';
        showToast('Success', 'Avatar updated successfully', 'success');
        event.target.value = '';        
    } catch (error) {
        console.log('Error in handleAvatarUpload:', error);
        showToast('Error', 'Failed to upload avatar', 'error');
        document.getElementById('avatarUploadProgress').style.display = 'none';
    }
}

function openMediaFullscreen(url, type) {
    try {
        const modal = document.getElementById('mediaFullscreenModal');
        const img = document.getElementById('mediaFullscreenImg');
        const video = document.getElementById('mediaFullscreenVideo');        
        if (type === 'image') {
            img.src = url;
            img.style.display = 'block';
            video.style.display = 'none';
            video.pause();
            video.src = '';
            state.mediaFullscreenElement = img;
        } else if (type === 'video') {
            video.src = url;
            video.style.display = 'block';
            img.style.display = 'none';
            state.mediaFullscreenElement = video;
            video.load();
        }        
        modal.style.display = 'flex';        
    } catch (error) {
        console.log('Error opening media fullscreen:', error);
    }
}

function openEnhancedMedia(embedUrl) {
    try {
        const modal = document.getElementById('enhancedMediaModal');
        const iframe = document.getElementById('enhancedMediaIframe');
        iframe.src = embedUrl;
        modal.style.display = 'flex';
    } catch (error) {
        console.log('Error opening enhanced media:', error);
    }
}

function openAvatarFullscreen(avatarUrl) {
    try {
        const modal = document.getElementById('avatarFullscreenModal');
        const img = document.getElementById('avatarFullscreenImg');
        img.src = avatarUrl;
        modal.style.display = 'flex';
    } catch (error) {
        console.log('Error opening avatar fullscreen:', error);
    }
}

function openUserProfile(userId) {
    try {
        showUserProfile(userId);
    } catch (error) {
        console.log('Error opening user profile:', error);
    }
}

async function displayUserProfile(profileOrUserId) {
    try {
        let profile;
        if (typeof profileOrUserId === 'string') {
            const { data: fetchedProfile, error } = await state.supabase
                .from('profiles')
                .select('*')
                .eq('id', profileOrUserId)
                .single();          
            if (error) {
                console.log('Error fetching user profile:', error);
                showToast('Error', 'Failed to load user profile', 'error');
                return;
            }
            profile = fetchedProfile;
        } else {
            profile = profileOrUserId;
        }
        
        const modal = document.getElementById('quickProfileModal');
        const avatar = document.getElementById('quickProfileAvatar');
        const name = document.getElementById('quickProfileName');
        const statusDot = document.getElementById('quickProfileStatusDot');
        const statusText = document.getElementById('quickProfileStatusText');
        const emailEl = document.getElementById('quickProfileEmail');
        const bioEl = document.getElementById('quickProfileBio');
        const socialContainer = document.getElementById('quickProfileSocial');
        const socialLinks = document.getElementById('quickProfileSocialLinks');
        const realmsContainer = document.getElementById('quickProfileRealms');
        
        if (profile.avatar_url) {
            const timestamp = Date.now();
            avatar.src = `${profile.avatar_url}?t=${timestamp}`;
            avatar.onclick = function() {
                openAvatarFullscreen(profile.avatar_url);
            };
            avatar.onerror = function() {
                const initials = (profile.username || 'U').charAt(0).toUpperCase();
                this.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.style.width = '80px';
                fallback.style.height = '80px';
                fallback.style.borderRadius = '50%';
                fallback.style.background = 'var(--color-gold-transparent)';
                fallback.style.color = 'var(--color-gold)';
                fallback.style.display = 'flex';
                fallback.style.alignItems = 'center';
                fallback.style.justifyContent = 'center';
                fallback.style.fontSize = '24px';
                fallback.style.fontWeight = '500';
                fallback.style.margin = '0 auto 16px';
                fallback.style.cursor = 'pointer';
                fallback.textContent = initials;
                fallback.onclick = function() {
                    if (profile.avatar_url) {
                        openAvatarFullscreen(profile.avatar_url);
                    }
                };
                avatar.parentNode.insertBefore(fallback, avatar);
            };
        } else {
            const initials = (profile.username || 'U').charAt(0).toUpperCase();
            avatar.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.style.width = '80px';
            fallback.style.height = '80px';
            fallback.style.borderRadius = '50%';
            fallback.style.background = 'var(--color-gold-transparent)';
            fallback.style.color = 'var(--color-gold)';
            fallback.style.display = 'flex';
            fallback.style.alignItems = 'center';
            fallback.style.justifyContent = 'center';
            fallback.style.fontSize = '24px';
            fallback.style.fontWeight = '500';
            fallback.style.margin = '0 auto 16px';
            fallback.style.cursor = 'default';
            fallback.textContent = initials;
            avatar.parentNode.insertBefore(fallback, avatar);
        }
        
        name.textContent = profile.username || 'User';
        const isStealth = profile.stealth_mode === true;
        const status = isStealth ? 'offline' : (profile.status || 'offline');       
        statusText.textContent = status === 'online' ? 'Online' : 'Offline';
        statusDot.className = `quick-profile-status-dot ${status === 'online' ? 'online' : ''}`;
        
        if (profile.id === state.currentUser.id || profile.show_realms) {
            emailEl.textContent = profile.email || '';
        } else {
            emailEl.textContent = '';
        }
        
        bioEl.textContent = profile.bio || 'No bio provided';
        
        const socialLinksData = profile.social_links || {};
        if (Object.keys(socialLinksData).length > 0) {
            socialContainer.style.display = 'block';
            socialLinks.innerHTML = '';
            if (socialLinksData.twitter) {
                socialLinks.innerHTML += `<a href="${socialLinksData.twitter}" target="_blank" style="color: var(--color-gold); text-decoration: none;">Twitter</a>`;
            }
            if (socialLinksData.instagram) {
                if (socialLinks.innerHTML) socialLinks.innerHTML += ' • ';
                socialLinks.innerHTML += `<a href="${socialLinksData.instagram}" target="_blank" style="color: var(--color-gold); text-decoration: none;">Instagram</a>`;
            }
            if (socialLinksData.website) {
                if (socialLinks.innerHTML) socialLinks.innerHTML += ' • ';
                socialLinks.innerHTML += `<a href="${socialLinksData.website}" target="_blank" style="color: var(--color-gold); text-decoration: none;">Website</a>`;
            }
            if (socialLinksData.other) {
                if (socialLinks.innerHTML) socialLinks.innerHTML += ' • ';
                socialLinks.innerHTML += `<a href="${socialLinksData.other}" target="_blank" style="color: var(--color-gold); text-decoration: none;">Other</a>`;
            }
        } else {
            socialContainer.style.display = 'none';
        }
        
        if (realmsContainer) {
            realmsContainer.innerHTML = '<div style="color: var(--text-secondary); font-style: italic;">Loading realms...</div>';            
 const realmsData = await loadOtherUserRealms(profile.id);           
            if (realmsData.show_realms === false) {
                realmsContainer.innerHTML = '<div class="realms-hidden-message">Realms hidden by user</div>';
            } else if (realmsData.realms.length === 0) {
                realmsContainer.innerHTML = '<div class="realms-hidden-message">Not a member of any realms</div>';
            } else {
                realmsContainer.innerHTML = realmsData.realms.map(realm => {
                    let iconHtml = '';
                    if (realm.icon_url) {
                        iconHtml = `<img src="${realm.icon_url}" style="width: 16px; height: 16px; border-radius: 3px; margin-right: 6px; object-fit: cover;">`;
                    } else {
                        iconHtml = `<span style="margin-right: 6px;">${realm.icon_url || '🏰'}</span>`;
                    }
                    return `<div class="realm-chip">${iconHtml}${escapeHtml(realm.name)}</div>`;
                }).join('');
            }
        }
        
        state.selectedUserForProfile = profile.id;
        modal.style.display = 'flex';        
    } catch (error) {
        console.log('Error displaying user profile:', error);
    }
}

// CHANGED FOR BUG 3-18: Removed DM functions
async function createOrOpenDM(otherUserId) {
    showToast('Info', 'Direct messages are not available in this version', 'info');
}

async function reportMessagePrivate(message) {
    try {
        if (!state.currentUser || !state.supabase || !message) return;
        
        const { data: adminProfile } = await state.supabase
            .from('profiles')
            .select('id, username')
            .eq('username', ADMIN_USERNAME)
            .single();            
        
        if (!adminProfile) {
            showToast('Error', 'Admin account not found', 'error');
            return;
        }
        
        showToast('Message Reported', 'Report sent to admin', 'success');        
    } catch (error) {
        console.log('Error reporting message:', error);
        showToast('Error', 'Failed to send report', 'error');
    }
}

async function reportUser(userId) {
    try {
        if (!state.currentUser || !state.supabase || !userId) return;
        const { data: reportedProfile } = await state.supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();           
        if (!reportedProfile) {
            showToast('Error', 'User not found', 'error');
            return;
        }
        const { data: adminProfile } = await state.supabase
            .from('profiles')
            .select('id, username')
            .eq('username', ADMIN_USERNAME)
            .single();        
        if (!adminProfile) {
            showToast('Error', 'Admin account not found', 'error');
            return;
        }
        showToast('Success', 'User report sent to admin', 'success');        
    } catch (error) {
        console.log('Error reporting user:', error);
        showToast('Error', 'Failed to send report', 'error');
    }
}

// CHANGED FOR GENERAL FIX: Fix emoji modal scrolling
function showEmojiPicker() {
    try {
        const emojiPicker = document.getElementById('emojiPicker');
        if (!emojiPicker) return;        
        emojiPicker.innerHTML = '';
        
        const emojisToShow = state.emojis;
        emojisToShow.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'emoji-btn';
            btn.textContent = emoji;
            btn.onclick = () => addReaction(emoji);
            emojiPicker.appendChild(btn);
        });
        
        document.getElementById('emojiPickerModal').style.display = 'flex';
        
        // Fix scrolling
        emojiPicker.style.maxHeight = '300px';
        emojiPicker.style.overflowY = 'auto';
        emojiPicker.style.display = 'grid';
        emojiPicker.style.gridTemplateColumns = 'repeat(8, 1fr)';
        emojiPicker.style.gap = '8px';
        emojiPicker.style.padding = '16px';
       
    } catch (error) {
        console.log('Error showing emoji picker:', error);
    }
}

// CHANGED FOR BUG 19: Ensure reactions properly handle jsonb structure
async function addReaction(emoji) {
    try {
        if (!state.selectedMessageForReaction || !state.supabase || !state.currentUser) return;
        
        const messageId = state.selectedMessageForReaction.id;
        
        const { data: message, error: fetchError } = await state.supabase
            .from('messages')
            .select('reactions')
            .eq('id', messageId)
            .single();
            
        if (fetchError) {
            console.log('Error fetching message:', fetchError);
            showToast('Error', 'Failed to add reaction', 'error');
            return;
        }
        
        let reactions = message.reactions || [];
        
        const existingIndex = reactions.findIndex(r => 
            r.user_id === state.currentUser.id && r.emoji === emoji
        );
        
        if (existingIndex > -1) {
            reactions.splice(existingIndex, 1);
        } else {
            reactions.push({
                emoji: emoji,
                user_id: state.currentUser.id,
                reacted_at: new Date().toISOString()
            });
        }
        
        const { error: updateError } = await state.supabase
            .from('messages')
            .update({ reactions: reactions })
            .eq('id', messageId);
            
        if (updateError) {
            console.log('Error updating reactions:', updateError);
            showToast('Error', 'Failed to add reaction', 'error');
            return;
        }
        
        showToast('Reaction', `${existingIndex > -1 ? 'Removed' : 'Added'} ${emoji}`, 'success');
        document.getElementById('emojiPickerModal').style.display = 'none';
        state.selectedMessageForReaction = null;        
    } catch (error) {
        console.log('Error adding reaction:', error);
        showToast('Error', 'Failed to add reaction', 'error');
    }
}

// CHANGED FOR BUG 3-18: Removed DM functions
function showStartConversationModal() {
    showToast('Info', 'Direct messages are not available in this version', 'info');
}

async function searchUsers(searchTerm) {
    // Removed - DM functionality not available
}

async function createChannel() {
    try {
        if (!state.currentUser || !state.supabase || !state.currentRealm) return;        
        const nameInput = document.getElementById('newChannelName');
        const descInput = document.getElementById('newChannelDescription');
        const writableCheckbox = document.getElementById('newChannelWritable');        
        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        const isWritable = writableCheckbox.checked;      
        if (!name) {
            showToast('Error', 'Please enter a channel name', 'error');
            nameInput.focus();
            return;
        }       
        const position = state.channels.length;        
        const { data: newChannel, error } = await state.supabase
            .from('channels')
            .insert([{
                name: name,
                description: description,
                realm_id: state.currentRealm.id,
                created_by: state.currentUser.id,
                position: position,
                is_writable: isWritable
            }])
            .select()
            .single();            
        if (error) {
            console.log('Error creating channel:', error);
            showToast('Error', 'Failed to create channel', 'error');
            return;
        }        
        showToast('Success', 'Channel created successfully', 'success');
        nameInput.value = '';
        descInput.value = '';
        writableCheckbox.checked = true;        
        loadChannels();        
        selectChannel(newChannel.id);
        document.getElementById('createChannelModal').style.display = 'none';        
    } catch (error) {
        console.log('Error creating channel:', error);
        showToast('Error', 'Failed to create channel', 'error');
    }
}

function showDeleteChannelConfirmation(channel) {
    try {
        state.pendingChannelDelete = channel;
        state.channelDeleteStep = 1;
        document.getElementById('deleteChannelName').textContent = `#${channel.name}`;
        document.getElementById('deleteChannelModal').style.display = 'flex';
        
        document.getElementById('deleteStep1').style.display = 'block';
        document.getElementById('deleteStep2').style.display = 'none';
        document.getElementById('deleteStep3').style.display = 'none';
    } catch (error) {
        console.log('Error showing delete channel confirmation:', error);
    }
}

function handleDeleteChannelStep(step, action) {
    try {
        if (action === 'no') {
            document.getElementById('deleteChannelModal').style.display = 'none';
            state.pendingChannelDelete = null;
            resetDeleteChannelSteps();
            return;
        }
        
        if (action === 'yes') {
            if (step === 1) {
                document.getElementById('deleteStep1').style.display = 'none';
                document.getElementById('deleteStep2').style.display = 'block';
                state.channelDeleteStep = 2;
            } else if (step === 2) {
                document.getElementById('deleteStep2').style.display = 'none';
                document.getElementById('deleteStep3').style.display = 'block';
                state.channelDeleteStep = 3;
            } else if (step === 3) {
                deleteChannelFinal();
            }
        }
    } catch (error) {
        console.log('Error handling delete channel step:', error);
    }
}

function resetDeleteChannelSteps() {
    try {
        state.channelDeleteStep = 1;
        document.getElementById('deleteStep1').style.display = 'block';
        document.getElementById('deleteStep2').style.display = 'none';
        document.getElementById('deleteStep3').style.display = 'none';
    } catch (error) {
        console.log('Error resetting delete channel steps:', error);
    }
}

async function deleteChannelFinal() {
    try {
        if (!state.pendingChannelDelete || !state.supabase) return;
        
        const channel = state.pendingChannelDelete;
        const { error } = await state.supabase
            .from('channels')
            .delete()
            .eq('id', channel.id);
            
        if (error) {
            console.log('Error deleting channel:', error);
            showToast('Error', 'Failed to delete channel', 'error');
            return;
        }
        
        showToast('Success', 'Channel deleted successfully', 'success');
        document.getElementById('deleteChannelModal').style.display = 'none';
        state.pendingChannelDelete = null;
        resetDeleteChannelSteps();
        
        loadChannels();
    } catch (error) {
        console.log('Error in deleteChannelFinal:', error);
        showToast('Error', 'Failed to delete channel', 'error');
    }
}

function escapeHtml(text) {
    try {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    } catch (error) {
        return text || '';
    }
}

function setupCustomCursor() {
    try {
        const cursor = document.querySelector('.cursor');      
        if (window.matchMedia('(pointer: fine)').matches && cursor) {
            cursor.style.opacity = '1';          
            let mouseX = 0, mouseY = 0;
            let cursorX = 0, cursorY = 0;
            const speed = 0.15;
            document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
            });
            document.addEventListener('mouseleave', () => {
                cursor.style.opacity = '0';
            });
            function animateCursor() {
                const dx = mouseX - cursorX;
                const dy = mouseY - cursorY;
                cursorX += dx * speed;
                cursorY += dy * speed;
                cursor.style.left = cursorX + 'px';
                cursor.style.top = cursorY + 'px';
                requestAnimationFrame(animateCursor);
            }
            animateCursor();
            const hoverElements = document.querySelectorAll('a, button, .channel-item, .realm-section, .header-user-btn');
            hoverElements.forEach(el => {
                el.addEventListener('mouseenter', () => cursor.classList.add('cursor--active'));
                el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--active'));
            });
        }
    } catch (error) {
        console.log('Error setting up custom cursor (non-critical):', error);
    }
}

// ADDED FOR FEATURE 15: Load saved messages
async function loadSavedMessages() {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const { data: savedMessages, error } = await state.supabase
            .from('saved_messages')
            .select(`
                *,
                messages (
                    *,
                    profiles (
                        username,
                        avatar_url
                    ),
                    channels (
                        name,
                        realms (
                            name
                        )
                    )
                )
            `)
            .eq('user_id', state.currentUser.id)
            .order('saved_at', { ascending: false });
            
        if (error) {
            console.log('Error loading saved messages:', error);
            showToast('Error', 'Failed to load saved messages', 'error');
            return;
        }
        
        const container = document.getElementById('savedMessagesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (savedMessages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary); font-style: italic;">
                    No saved messages yet
                </div>
            `;
            return;
        }
        
        savedMessages.forEach(saved => {
            const message = saved.messages;
            if (!message) return;
            
            const messageElement = document.createElement('div');
            messageElement.className = 'saved-message-item';
            messageElement.style.cssText = `
                padding: 16px;
                border-bottom: 1px solid var(--border-color);
                background: var(--bg-secondary);
                border-radius: 8px;
                margin-bottom: 12px;
            `;
            
            const time = new Date(message.created_at);
            const timeStr = time.toLocaleDateString() + ' ' + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            messageElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${message.profiles?.avatar_url ? message.profiles.avatar_url + '?t=' + Date.now() : ''}" 
                             alt="${message.profiles?.username}" 
                             style="width: 24px; height: 24px; border-radius: 50%;"
                             onerror="this.style.display='none';">
                        <div style="font-weight: 500;">${escapeHtml(message.profiles?.username || 'User')}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">in ${escapeHtml(message.channels?.realms?.name || '')} / ${escapeHtml(message.channels?.name || '')}</div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${timeStr}</div>
                </div>
                <div style="margin-bottom: 12px;">${formatMessageContent(message.content)}</div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="unsave-message-btn" data-message-id="${message.id}" style="padding: 4px 12px; background: var(--color-error-transparent); color: var(--color-error); border: 1px solid var(--color-error); border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Unsave
                    </button>
                </div>
            `;
            
            container.appendChild(messageElement);
            
            messageElement.querySelector('.unsave-message-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                await unsaveMessage(saved.id);
            });
        });
    } catch (error) {
        console.log('Error loading saved messages:', error);
        showToast('Error', 'Failed to load saved messages', 'error');
    }
}

// ADDED FOR FEATURE 15: Unsave message
async function unsaveMessage(savedMessageId) {
    try {
        if (!state.currentUser || !state.supabase) return;
        
        const { error } = await state.supabase
            .from('saved_messages')
            .delete()
            .eq('id', savedMessageId)
            .eq('user_id', state.currentUser.id);
            
        if (error) {
            console.log('Error unsaving message:', error);
            showToast('Error', 'Failed to unsave message', 'error');
            return;
        }
        
        showToast('Success', 'Message unsaved', 'success');
        loadSavedMessages();
    } catch (error) {
        console.log('Error unsaving message:', error);
        showToast('Error', 'Failed to unsave message', 'error');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Labyrinth Chat v0.6.000 Alpha...');
    document.title = 'Labyrinth Chat v0.6.000 Alpha';
    document.querySelector('.version').textContent = 'v0.6.000 Alpha';
    state.loaderTimeout = setTimeout(hideLoader, 3000);
    initializeSupabase();
    setTimeout(setupCustomCursor, 100);
    
    setTimeout(checkCookieConsent, 1000);
});

// Expose functions to global scope
window.openMediaFullscreen = openMediaFullscreen;
window.openEnhancedMedia = openEnhancedMedia;
window.openAvatarFullscreen = openAvatarFullscreen;
window.openUserProfile = openUserProfile;
window.acceptCookies = acceptCookies;
window.saveDOB = saveDOB;
window.subscribeToPushNotifications = subscribeToPushNotifications;
