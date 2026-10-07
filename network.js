/**
 * Vanguard P2P Multiplayer & Local Session Manager
 * Uses WebRTC (PeerJS) for 100% serverless, zero-database online play,
 * plus Hotseat / Pass-and-Play mode for instant local testing on localhost.
 */

class NetworkManager {
    constructor(engine, onPeerConnected, onActionReceived) {
        this.engine = engine;
        this.onPeerConnected = onPeerConnected;
        this.onActionReceived = onActionReceived;
        this.peer = null;
        this.conn = null;
        this.isHost = true;
        this.myPlayerId = 1; // In local mode, controls both or toggles
        this.isOnline = false;
        this.roomId = null;
    }

    initLocalMode() {
        this.isOnline = false;
        this.myPlayerId = 1;
        this.engine.log("Mode: Local Hotseat / Sandbox. You can control both players.", "info");
    }

    createRoom(onRoomCreated) {
        this.isOnline = true;
        this.isHost = true;
        this.myPlayerId = 1;

        // PeerJS free public broker
        this.peer = new Peer({
            debug: 1
        });

        this.peer.on('open', (id) => {
            this.roomId = id;
            this.engine.log(`Room created with ID: ${id}`, "highlight");
            if (onRoomCreated) onRoomCreated(id);
        });

        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupConnectionHandlers();
            this.engine.log("Opponent connected to your room!", "highlight");
            if (this.onPeerConnected) this.onPeerConnected(2);
        });

        this.peer.on('error', (err) => {
            this.engine.log(`P2P Connection Error: ${err.message}`, "warn");
        });
    }

    joinRoom(targetRoomId, onJoined) {
        this.isOnline = true;
        this.isHost = false;
        this.myPlayerId = 2; // Guest is player 2
        this.roomId = targetRoomId;

        this.peer = new Peer({
            debug: 1
        });

        this.peer.on('open', (id) => {
            this.conn = this.peer.connect(targetRoomId, { reliable: true });
            this.setupConnectionHandlers();

            this.conn.on('open', () => {
                this.engine.log(`Successfully connected to Room: ${targetRoomId}!`, "highlight");
                if (onJoined) onJoined(targetRoomId);
                if (this.onPeerConnected) this.onPeerConnected(2);
            });
        });

        this.peer.on('error', (err) => {
            this.engine.log(`P2P Join Error: ${err.message}`, "warn");
        });
    }

    setupConnectionHandlers() {
        this.conn.on('data', (data) => {
            if (this.onActionReceived) {
                this.onActionReceived(data);
            }
        });

        this.conn.on('close', () => {
            this.engine.log("Opponent disconnected.", "warn");
        });
    }

    sendAction(actionType, payload) {
        if (this.isOnline && this.conn && this.conn.open) {
            this.conn.send({ actionType, payload, sender: this.myPlayerId });
        }
    }
}
