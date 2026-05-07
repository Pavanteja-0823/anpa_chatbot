import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ["user", "assistant", "system"]
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
