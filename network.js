/**
 * Vanguard P2P Multiplayer & Local Session Manager
 * Uses WebRTC (PeerJS) for 100% serverless, zero-database online play,
 * plus Hotseat / Pass-and-Play mode for instant local testing.
 */

class NetworkManager {
    constructor(engine, onPeerConnected, onActionReceived) {
        this.engine = engine;
        this.onPeerConnected = onPeerConnected;
        this.onActionReceived = onActionReceived;
        this.peer = null;
        this.conn = null;
        this.isHost = true;
        this.myPlayerId = 1; // 1 for Host (P1), 2 for Guest (P2)
        this.isOnline = false;
        this.roomId = null;
    }

    initLocalMode() {
        this.isOnline = false;
        this.isHost = true;
        this.myPlayerId = 1;
        this.disconnect();
        if (this.engine) {
            this.engine.log("Mode: Local Hotseat / Sandbox. You can control both players.", "info");
        }
    }

    ensurePeerLibrary() {
        if (typeof Peer !== 'undefined') return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'peerjs.min.js?v=46';
            script.onload = () => resolve();
            script.onerror = () => {
                const cdnScript = document.createElement('script');
                cdnScript.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
                cdnScript.onload = () => resolve();
                cdnScript.onerror = () => reject(new Error('Gagal memuat pustaka PeerJS. Pastikan Anda memiliki koneksi internet.'));
                document.head.appendChild(cdnScript);
            };
            document.head.appendChild(script);
        });
    }

    createRoom(onRoomCreated, onError) {
        this.isOnline = true;
        this.isHost = true;
        this.myPlayerId = 1;

        this.ensurePeerLibrary().then(() => {
            this.disconnect();

            const generateShortId = () => 'vg-' + Math.random().toString(36).substring(2, 8);
            const tryInitPeer = (customId = null) => {
                const options = {
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    }
                };

                const peer = customId ? new Peer(customId, options) : new Peer(options);

                peer.on('open', (id) => {
                    this.peer = peer;
                    this.roomId = id;
                    if (this.engine) this.engine.log(`P2P Room siap! Room ID: ${id}`, "highlight");
                    if (onRoomCreated) onRoomCreated(id);
                });

                peer.on('connection', (conn) => {
                    this.conn = conn;
                    this.setupConnectionHandlers();
                    if (this.engine) this.engine.log("Lawan (Player 2) berhasil terhubung ke Room!", "highlight");
                    if (this.onPeerConnected) this.onPeerConnected(2);
                });

                peer.on('error', (err) => {
                    console.warn('PeerJS Room Error:', err);
                    if (err.type === 'unavailable-id') {
                        tryInitPeer(null);
                        return;
                    }
                    if (onError) onError(err.message || String(err));
                    if (this.engine) this.engine.log(`P2P Error: ${err.message || err.type}`, "warn");
                });
            };

            tryInitPeer(generateShortId());
        }).catch(err => {
            if (onError) onError(err.message);
        });
    }

    joinRoom(targetRoomId, onJoined, onError) {
        this.isOnline = true;
        this.isHost = false;
        this.myPlayerId = 2; // Guest is always Player 2

        const cleanId = (targetRoomId || '').trim();
        if (!cleanId) {
            if (onError) onError('Room ID tidak boleh kosong.');
            return;
        }
        this.roomId = cleanId;

        this.ensurePeerLibrary().then(() => {
            this.disconnect();

            this.peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('open', () => {
                const conn = this.peer.connect(cleanId, {
                    reliable: true
                });
                this.conn = conn;
                this.setupConnectionHandlers();

                let connected = false;
                conn.on('open', () => {
                    connected = true;
                    if (this.engine) this.engine.log(`Berhasil terhubung ke Host di Room: ${cleanId}!`, "highlight");
                    if (onJoined) onJoined(cleanId);
                    if (this.onPeerConnected) this.onPeerConnected(1);
                });

                setTimeout(() => {
                    if (!connected && this.isOnline && !this.isHost) {
                        if (onError) onError('Koneksi timeout. Pastikan Room ID benar dan Host masih aktif.');
                    }
                }, 12000);
            });

            this.peer.on('error', (err) => {
                console.warn('PeerJS Join Error:', err);
                let msg = err.message || String(err);
                if (err.type === 'peer-unavailable') {
                    msg = `Room "${cleanId}" tidak ditemukan. Pastikan Host belum menutup room.`;
                }
                if (onError) onError(msg);
                if (this.engine) this.engine.log(`P2P Join Error: ${msg}`, "warn");
            });
        }).catch(err => {
            if (onError) onError(err.message);
        });
    }

    setupConnectionHandlers() {
        if (!this.conn) return;

        this.conn.on('data', (data) => {
            if (this.onActionReceived) {
                this.onActionReceived(data);
            }
        });

        this.conn.on('close', () => {
            if (this.engine) this.engine.log("Koneksi P2P dengan lawan terputus.", "warn");
        });

        this.conn.on('error', (err) => {
            console.warn('DataChannel error:', err);
        });
    }

    sendAction(actionType, payload = {}) {
        if (this.isOnline && this.conn && this.conn.open) {
            try {
                this.conn.send({ actionType, payload, sender: this.myPlayerId, timestamp: Date.now() });
            } catch (e) {
                console.error('Failed to send action:', e);
            }
        }
    }

    disconnect() {
        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
        this.roomId = null;
    }
}
