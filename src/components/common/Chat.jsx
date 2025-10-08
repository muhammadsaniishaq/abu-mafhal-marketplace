import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

const Chat = ({ conversationId, otherUser }) => {
  const { currentUser } = useAuth();
  const { sendMessage, markAsRead } = useChat();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      scrollToBottom();
    });

    markAsRead(conversationId);

    return () => unsubscribe();
  }, [conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const uploadedUrls = [];

    for (const file of files) {
      const fileRef = ref(storage, `chat/${conversationId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      uploadedUrls.push({ url, type: file.type, name: file.name });
    }

    setAttachments([...attachments, ...uploadedUrls]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;

    try {
      await sendMessage(conversationId, newMessage, attachments);
      setNewMessage('');
      setAttachments([]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
          {otherUser?.avatar ? (
            <img src={otherUser.avatar} alt={otherUser.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">👤</div>
          )}
        </div>
        <div>
          <h3 className="font-semibold">{otherUser?.name}</h3>
          {isTyping && <p className="text-xs text-gray-500">typing...</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.senderId === currentUser.uid
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              {msg.message && <p>{msg.message}</p>}
              {msg.attachments?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.attachments.map((att, i) => (
                    <div key={i}>
                      {att.type.startsWith('image/') ? (
                        <img src={att.url} alt="Attachment" className="rounded max-w-full" />
                      ) : (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {att.name}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs opacity-70 mt-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="p-2 bg-gray-100 dark:bg-gray-800 flex gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative">
              <img src={att.url} alt="Preview" className="w-16 h-16 object-cover rounded" />
              <button
                onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800 border-t">
        <div className="flex gap-2">
          <label className="cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            📎
            <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;