import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Message = {
  id: number
  text: string
  sender: "user" | "other"
}

export default function Component() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hey there! How can I assist?", sender: "other" },
  ])
  const [newMessage, setNewMessage] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.sender === "other") {
        // Add the OpenAI response to the messages
        setMessages((prevMessages) => [
          ...prevMessages,
          { id: Date.now(), text: message.text, sender: "other" },
        ]);
      }
    });
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (newMessage.trim()) {
      const messageObject = {
        id: Date.now(),
        text: newMessage,
        sender: "user",
      };

      setMessages([...messages, { id: Date.now(), text: newMessage, sender: "user" }])
      setNewMessage("")

      chrome.runtime.sendMessage(messageObject, (response) => {
        console.log("Message sent to background script:", response);
      });
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto border rounded-lg overflow-hidden">
      <div className="bg-gray-100 p-4 border-b">
        <h1 className="text-xl font-semibold">Chat</h1>
      </div>
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} mb-4`}
          >
            {message.sender === "other" && (
              <Avatar className="w-8 h-8 mr-2">
                <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Avatar" />
                <AvatarFallback>OT</AvatarFallback>
              </Avatar>
            )}
            <div
              className={`rounded-lg p-3 max-w-[70%] ${
                message.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </ScrollArea>
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-grow"
          />
          <Button type="submit">Send</Button>
        </div>
      </form>
    </div>
  )
}