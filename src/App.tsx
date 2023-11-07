import { useEffect, useState } from "react";
import "./App.css";
import {
  LightNode,
  Protocols,
  createDecoder,
  createEncoder,
  createLightNode,
  waitForRemotePeer,
} from "@waku/sdk";
import protobuf from "protobufjs";
import { bootstrap } from "@libp2p/bootstrap";

const ChatMessage = new protobuf.Type("ChatMessage")
  .add(new protobuf.Field("timestamp", 1, "uint64"))
  .add(new protobuf.Field("sender", 2, "string"))
  .add(new protobuf.Field("message", 3, "string"));

const contentTopic = "/poops/1/message/proto";

function App() {
  const [status, setStatus] = useState("disconnected");
  const [text, setText] = useState("");
  const [sender, setSender] = useState("");
  const [node, setNode] = useState<LightNode>();

  const [messages, setMessages] = useState<protobuf.Message[]>([]);
  const [localPeerId, setLocalPeerId] = useState("");
  const [remotePeerIds, setRemotePeerIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const node = await createLightNode({
        libp2p: {
          peerDiscovery: [
            bootstrap({
              list: [
                "/ip4/0.0.0.0/tcp/60001/ws/p2p/16Uiu2HAm2y7so3rBo6vNF5X5e31oDx9XYUdag4deiXK7kRoHXuxE",
              ],
            }),
          ],
        },
      });
      setNode(node);
      setStatus("starting");
      await node.start();
      setStatus("connecting");

      await waitForRemotePeer(node, [Protocols.LightPush, Protocols.Filter]);
      setStatus("connected");

      const localPeerId = node.libp2p.peerId.toString();
      setLocalPeerId(localPeerId);

      const remotePeers = await node.libp2p.peerStore.all();
      const remotePeerIds = remotePeers.map((peer) => peer.id.toString());
      setRemotePeerIds(remotePeerIds);

      const decoder = createDecoder(contentTopic);

      const subscription = await node.filter.createSubscription();

      await subscription.subscribe([decoder], (wakuMessage) => {
        if (!wakuMessage.payload) return;
        // Render the messageObj as desired in your application
        const messageObj = ChatMessage.decode(wakuMessage.payload);
        setMessages((messages) => [...messages, messageObj]);
      });
    })();
  }, []);

  return (
    <div className="content">
      <div className="header">
        <h3>
          Status: <span id="status">{status}</span>
        </h3>

        <details>
          <summary>Peer's information</summary>

          <h4>Content topic</h4>
          <p id="contentTopic">{contentTopic}</p>

          <h4>Local Peer Id</h4>
          <p id="localPeerId">
            {localPeerId} ({remotePeerIds.length} peers connected)
          </p>

          <h4>Remote Peer Id</h4>
          <p id="remotePeerId">
            {remotePeerIds.map((peerId) => (
              <p>{peerId}</p>
            ))}
          </p>
        </details>
      </div>

      <div id="messages">
        {messages.map((message, index) => (
          <div key={index}>
            <p>
              {message.toJSON().sender} - {message.toJSON().message}
            </p>
          </div>
        ))}
      </div>

      <div className="footer">
        <div className="inputArea">
          <input
            type="text"
            id="nickText"
            placeholder="Nickname"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
          <textarea
            id="messageText"
            placeholder="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
          ></textarea>
        </div>

        <div className="controls">
          <button
            id="send"
            onClick={async () => {
              const encoder = createEncoder({ contentTopic });

              const protoMessage = ChatMessage.create({
                timestamp: Date.now(),
                sender,
                message: text,
              });

              const serialisedMessage =
                ChatMessage.encode(protoMessage).finish();
              await node?.lightPush.send(encoder, {
                payload: serialisedMessage,
              });
            }}
          >
            Send
          </button>
          <button id="exit">Exit chat</button>
        </div>
      </div>
    </div>
  );
}

export default App;
