"use strict";
const crypto    = require("crypto");
const client    = require("../../lib/client");
const cli       = require("../../lib/ui");
let username    = "Anonymous";
let publicKey   = undefined;
let privateKey  = undefined;
let nodeHost    = undefined;
let nodePort    = undefined;
let activePeers       = [];

// Hmm, okay.

let leaderId    = undefined; // who am i following || null
let manifest = new Map(); // my direct peers (not distributed)

class nodeManager {
  static addPeer ( peer ) {
    if ( !activePeers.includes( peer ) ) activePeers.push( peer );
  }

  static get getPeers () {
    return activePeers;
  }

  static setUsername( user ) {
    username = user;
  }

  static get getUsername () {
    return username;
  }

  static setNodeHost ( host ) {
    nodeHost = host;
  }

  static get getNodeHost () {
    return nodeHost;
  }

  static setNodePort ( port ) {
    nodePort = port;
  }

  static get getNodePort () {
    return nodePort;
  }

  static get getNodeId () {
    return this.generatePeerId( publicKey );
  }

  static connectToNode( host, port ) {
    new client( host, port, nodeManager );
  }

  static setPublicKey ( key ) {
    publicKey = key;
  }

  static get getPublicKey () {
    return publicKey;
  }

  static setPrivateKey ( key ) {
    privateKey = key;
  }

  static get getPrivateKey () {
    return privateKey;
  }

  static get getLeader() {
    return leaderId;
  }

  static setLeader ( id ) {
    leaderId = id;
  }

  static addNode ( clientInstance ) {
    if ( this.getNode ( clientInstance.nodeId ) ||
        clientInstance.nodeId === this.getNodeId ) {
      return false;
    }

    manifest.set( clientInstance.nodeId, clientInstance );
  }

  static removeNode ( nodeId ) {
    if ( this.getNode( nodeId ) ) {
      manifest.delete( nodeId );
    }
  }

  static sendNodeEvent ( event, object ) {
    let message = {
      "type"      : event,
      "content"   : object
    };

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId && peer !== object.nodeId ) {
        message = JSON.stringify( message );
        peerSocket.write( message );
      }
    });
  }

  static sendEndEvent() {
    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId ) {
        let payload   = {
          "type"    : "disconnecting",
          "content" : {
            "nodeId"   : this.getNodeId
          }
        };

        payload = JSON.stringify( payload );
        peerSocket.write(payload);
      }
    });
  }

  static sendNewPeerMessage ( peerId ) {
    let peers = [this.getNodeId];
    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId && peer !== peerId ) {
        peers.push( peer );
      }
    });

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId && peer !== peerId ) {
        let payload = {
          "type"      : "peerJoined",
          "content"   : {
            "peers"   : peers,
            "peerId"   : peerId
          }
        };

        payload = JSON.stringify( payload );
        peerSocket.write( payload );
      }
    });
  }

  static relayNewPeerMessage( peerId, peerArray ) {
    let peers = peerArray.slice();

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId && !peers.includes( peer ) ) {
        peers.push( peer );
      }
    });

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId ) {
        if ( !peerArray.includes( peer ) ) {
          let payload = {
            "type"      : "peerJoined",
            "content"   : {
              "peers"   : peers,
              "peerId"  : peerId
            }
          };

          payload = JSON.stringify( payload );
          peerSocket.write( payload );
        }
      }
    });    
  }

  static sendPrivateMessage( peerId, username, message ) {
    const crypto  = require('crypto');
    let encrypted = crypto.publicEncrypt( this.getNodeKey( peerId ), Buffer.from( message, 'utf-8') );
    let payload   = {
      "type"    : "privateMessage",
      "content" : {
        "peerId"   : this.getNodeId,
        "username" : username,
        "message"  : encrypted
      }
    };

    payload = JSON.stringify( payload );
    manifest.get( peerId ).write( payload );   
  }

  static sendPublicMessage( username, message ) {
    const crypto = require('crypto');

    let peers = [this.getNodeId];
    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId ) {
        peers.push( peer );
      }
    });

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId ) {
        let encrypted = crypto.privateEncrypt( privateKey, Buffer.from( message, 'utf-8') );
        let payload = {
          "type"      : "publicMessage",
          "content"   : {
            "peerId"   : peers,
            "username" : username,
            "message"  : encrypted
          }
        };

        payload = JSON.stringify( payload );
        peerSocket.write( payload );
      }
    });

  }

  static relayPublicMessage( peerId, username, message ) {
    const crypto = require('crypto');
    let peers = peerId.slice();

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId && !peers.includes( peer ) ) {
        peers.push( peer );
      }
    });

    manifest.forEach( ( peerSocket, peer ) => {
      if ( peer !== this.getNodeId ) {
        if ( !peerId.includes(peer) ) {
          let encrypted = crypto.publicEncrypt( this.getNodeKey( peer ), Buffer.from( message, 'utf-8') );
          let payload = {
            "type"      : "publicMessage",
            "content"   : {
              "peerId"   : peers,
              "username" : username,
              "message"  : encrypted
            }
          };

          payload = JSON.stringify( payload );
          peerSocket.write( payload );
        }
      }
    });
  }

  static generatePeerId ( key ) {
    return crypto.createHmac("sha256", key).digest("hex");
  }

  static addKeyToChain ( peerId, publicKey ) {
    manifest.get( peerId ).publicKey = publicKey;
  }

  static getNodeKey ( nodeId ) {
    return manifest.get( nodeId ).publicKey;
  }

  static getManifest( ) {
    return manifest;
  }

  static getManifestEntry( id ) {
    return manifest.get( id );
  }

  static getNodes () {
    return Array.from( manifest.keys() );
  }

  static getNode ( nodeId ) {
    if ( manifest.has( nodeId ) ) {
      return true;
    }
    return false;
  }
}

module.exports = nodeManager;