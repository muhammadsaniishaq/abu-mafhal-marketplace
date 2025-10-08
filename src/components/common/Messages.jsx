import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserConversations, getMessages, sendMessage, subscribeToMessages, markMessagesAsRead } from '../../services/chatService';
import { collection, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const Messages = () => {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, [currentUser]);

  useEffect(() => {
    if (selectedConversation) {
      fetchOtherUser();
      markMessagesAsRead(selectedConversation.id, currentUser.role);
      
      // Subscribe to real-time messages
      const unsubscribe = subscribeToMessages(selectedConversation.id, (msgs) => {
        setMessages(msgs);
        scrollToBottom();
      });
      
      return () => unsubscribe();
    }
  }, [selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const convs = await getUserConversations(currentUser.uid, currentUser.role);
      setConversations(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherUser = async () => {
    try {
      const userId = currentUser.role === 'buyer' 
        ? selectedConversation.vendorId 
        : selectedConversation.buyerId;
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      setOtherUser({ id: userDoc.id, ...userDoc.data() });
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage(
        selectedConversation.id,
        currentUser.uid,
        currentUser.role,
        newMessage
      );
      setNewMessage('');
      fetchConversations(); // Refresh conversation list
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Conversations List */}
      <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 border-r dark:border-gray-700 overflow-y-auto">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold">Messages</h2>
        </div>

        {conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-4xl mb-2">💬</p>
            <p>No conversations yet</p>
          </div>
        ) : (
          <div>
            {conversations.map(conv => {
              const unreadCount = currentUser.role === 'buyer' 
                ? conv.buyerUnread 
                : conv.vendorUnread;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold">
                      {currentUser.role === 'buyer' ? 'Vendor' : 'Customer'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                    {conv.lastMessage || 'Start a conversation'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {conv.lastMessageAt && getTimeAgo(conv.lastMessageAt.toDate?.() || conv.lastMessageAt)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 p-4 border-b dark:border-gray-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                {otherUser?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-semibold">{otherUser?.name || 'Loading...'}</p>
                <p className="text-xs text-gray-500">{otherUser?.email}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                      msg.senderId === currentUser.uid
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.senderId === currentUser.uid ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {getTimeAgo(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="bg-white dark:bg-gray-800 p-4 border-t dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-6xl mb-4">💬</p>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;