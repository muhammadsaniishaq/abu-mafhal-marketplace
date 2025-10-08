import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import Chat from './Chat';

const ChatWindow = () => {
  const { conversationId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversationDetails();
  }, [conversationId]);

  const fetchConversationDetails = async () => {
    try {
      const convoDoc = await getDoc(doc(db, 'conversations', conversationId));
      if (convoDoc.exists()) {
        const data = convoDoc.data();
        const otherUserId = data.participants.find(id => id !== currentUser.uid);
        setOtherUser(data.participantDetails[otherUserId]);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="bg-white dark:bg-gray-800 border-b p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/messages')}
          className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-10 h-10 rounded-full flex items-center justify-center"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Chat with {otherUser?.name}</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <Chat conversationId={conversationId} otherUser={otherUser} />
      </div>
    </div>
  );
};

export default ChatWindow;