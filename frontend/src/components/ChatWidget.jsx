import { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a friendly ordering assistant for a bubble tea shop. Help customers choose drinks, explain menu items, suggest customizations (milk tea, fruit tea, toppings, sweetness levels, ice levels), and guide them through placing their order. Keep responses concise and friendly. Only answer questions related to the menu and ordering process.`;

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can help you pick a drink or customize your order. What sounds good?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
}