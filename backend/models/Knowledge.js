import mongoose from "mongoose";

const knowledgeSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  source: {
    type: String,
    default: "PDF Upload"
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Knowledge = mongoose.model("Knowledge", knowledgeSchema);
export default Knowledge;
