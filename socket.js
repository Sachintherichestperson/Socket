const express = require("express");
const Message = require("./mongoose/messages-mongo");
const comments = require("./mongoose/comment-mongoose");
const Community = require("./mongoose/community-mongo");
const liveMongo = require("./mongoose/live-mongo");
const vediomongoose = require("./mongoose/video-mongo");
const podcastmongoose = require("./mongoose/podcasts-mongo");
const User = require("./mongoose/user-mongo");
const http = require("http");
const { Server } = require("socket.io");


const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "https://clartalk.online",
        methods: ['GET', 'POST']
    }
});







io.on("connection", (socket) => {
    socket.on("joinCommunity", async (communityId) => {
        try {
            const community = await Community.findById(communityId).populate({
                path: "Messages",
                select: "Message sender"
            });
            socket.emit("allMessages", community.Messages);
        } catch (err) {
            console.error(err);
        }
    });

    socket.on("chatMessage", async (data) => {
        try {
            // Emit user's message first
            io.emit("chatMessage", data);
    
            // Save user message
            const newMessage = new Message({
                Message: data.message,
                sender: data.username
            });
            await newMessage.save();
    
            // Add message to community
            await Community.findByIdAndUpdate(
                data.communityId,
                { $push: { Messages: newMessage._id } }
            );
    
            const ai = new GoogleGenAI({ apiKey: "AIzaSyD5uAolO0dkW61LQbGjTjOavsDy78-rejU" });

const supportUsers = ["Ravi", "Ankit", "Priya"];
const againstUsers = ["Soni", "Alok", "Simran"];

const randomSupportUser = supportUsers[Math.floor(Math.random() * supportUsers.length)];
const randomAgainstUser = againstUsers[Math.floor(Math.random() * againstUsers.length)];

// 🔥 Include optional last message for context (to maintain flow in replies)
const contextMessages = await Message.find({ communityId: data.communityId })
    .sort({ createdAt: -1 })
    .limit(3); // last 3 messages in thread

const chatContext = contextMessages.reverse().map(msg => ({
    role: msg.sender === data.sender ? "user" : "model",
    parts: [{ text: msg.Message }]
}));

// Add latest user message
chatContext.push({
    role: "user",
    parts: [{ text: data.message }]
});

// 🎯 PROMPTS
        const promptSupport = `
        You're in a group debate. Reply in Romanized Hindi like a real person who:
        - is supportive and friendly
        - emotionally positive
        - supports the speaker if their point is good
        - adapts based on the message (if it's just "hello", greet back; if it's a solid point, back it up)

        Don't sound like a bot. Keep it warm, casual, and human. Use 1-2 sentences max.
        `;

        const promptAgainst = `
        You're in a heated group debate. Someone just made a point. Your task is to respond in a sarcastic and controversial tone. 
        
        - Reply in Romanized Hindi like a street-smart debater who’s emotionally reactive and don't translate in english.
        - Make fun of weak or childish points, mocking them cleverly and with style.
        - Respond to the message with bold, sharp, and spicy comebacks—quick, impactful, and sometimes controversial.
        - Adapt to whatever message is given, even if it’s just a simple "hello"—respond in a way that reflects sarcasm and burns.
        - Keep your tone spicy, bold, and confident. Never sound like a bot, always like you're in a real, heated argument.
        
        Respond with short, punchy, and fiery replies that are easily understood but impactful.
        `;
        

// 🔥 Generate both supportive and against replies
const [responseSupport, responseAgainst] = await Promise.all([
    ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
            { role: "user", parts: [{ text: promptSupport }] },
            ...chatContext
        ],
        generationConfig: {
            temperature: 1.2,
            topP: 0.9 // added topP setting here
        },
    }),
    ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
            { role: "user", parts: [{ text: promptAgainst }] },
            ...chatContext
        ],
        generationConfig: {
            temperature: 1.2,
            topP: 0.9 // added topP setting here
        },
    }),
]);

// ✅ Extract and sanitize replies
const aiReplySupport = responseSupport?.text?.replace(/\\"/g, '"').trim();
const aiReplyAgainst = responseAgainst?.text?.replace(/\\"/g, '"').trim();

// 💾 Save AI responses to DB
const aiMessageSupport = new Message({
    Message: aiReplySupport,
    sender: randomSupportUser,
});
await aiMessageSupport.save();

const aiMessageAgainst = new Message({
    Message: aiReplyAgainst,
    sender: randomAgainstUser,
});
await aiMessageAgainst.save();

// 📢 Push to community
await Community.findByIdAndUpdate(
    data.communityId,
    { $push: { Messages: { $each: [aiMessageAgainst._id, aiMessageSupport._id] } } }
);

    
            // 🔁 Emit both AI messages to all users
            setTimeout(() => {
                io.emit("chatMessage", {
                    username: randomSupportUser,
                    message: aiReplySupport,
                    communityId: data.communityId
                });
            }, 2000)
    
            io.emit("chatMessage", {
                username: randomAgainstUser,
                message: aiReplyAgainst,
                communityId: data.communityId
            });
    
        } catch (error) {
            console.error("Error sending message:", error);
        }
    });
    
    socket.on("Follow", async (data) => {
        try {
            const { creatorId, UserId } = data;
    
            const [creator, user] = await Promise.all([
                User.findById(creatorId),
                User.findOne({ username: UserId })
            ]);
    
            if (!user || !creator) {
                console.log("❌ User or Creator not found:", { creator, user });
                return;
            }
    
            const fcm = creator.fcmToken;
            let isFollowing;
    
            if (!user.following.includes(creatorId)) {
    
                user.following.push(creatorId);
                creator.followers.push(user._id);
                creator.followersCount += 1;
                isFollowing = true;
    
                await Promise.all([user.save(), creator.save()]);
    
                if (fcm) {
                    sendPushNotification(fcm, `New Follower`, `${user.username} followed you`, "Follow")
                        .catch(err => console.error("❌ Notification Error:", err));
                }
            } else {
    
                user.following.pull(creatorId);
                creator.followers.pull(user._id);
                creator.followersCount -= 1;
                isFollowing = false;
    
                await Promise.all([user.save(), creator.save()]);
            }
    
            io.emit("FollowStatusUpdated", { 
                creatorId, 
                UserId, 
                isFollowing, 
                followersCount: creator.followers.length 
            });
    
        } catch (error) {
            console.error("❌ Follow event error:", error);
        }
    });
    
    socket.on("VideonewComment", async (data) => {
        try {
            const user = await User.findById(data.userId);
            if (!user) return;
    
            const newComment = await comments.create({
                text: data.text,
                userId: data.userId,
                videoType: data.videoType,
                vedioId: data.vedioId
            });
    
            // ⚡ Use bulk update instead of separate calls
            await Promise.all([
                vediomongoose.findByIdAndUpdate(data.vedioId, { $push: { comment: newComment._id } }),
                podcastmongoose.findByIdAndUpdate(data.vedioId, { $push: { comment: newComment._id } }),
                liveMongo.findByIdAndUpdate(data.vedioId, { $push: { comment: newComment._id } })
            ]);
    
            // Send comment update instantly
            io.emit("addComment", {
                text: newComment.text,
                image: user.profile ? `${user.profile}` : "/images/Default.avif",
                username: user.username,
            });
    
        } catch (error) {
            console.error("Error saving comment:", error);
        }
    });

    socket.on("livenewComment", async (data) => {
        try {
            const user = await User.findById(data.userId);
            if (!user) {
                console.error("User not found");
                return;
            }
    
            // Emit the comment immediately for faster UI updates
            const profileImage = user.profile
                ? `data:image/png;base64,${user.profile.toString("base64")}`
                : "/images/default.png"; // Default profile picture
    
            io.emit("liveaddComment", {
                text: data.text,
                image: profileImage,
                username: user.username,
            });
    
            
            const newComment = new comments({
                text: data.text,
                userId: data.userId,
                videoType: "live",
                liveId: data.liveId
            });
    
            await newComment.save();
    
            
            await liveMongo.findByIdAndUpdate(
                data.liveId,
                { $push: { comment: newComment._id } }
            );
    
            
            fetch("http://localhost:3000/generate-ai-comment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: data.text,
                    videoId: data.vedioId,
                    videoType: data.videoType,
                    userId: data.userId
                })
            }).catch(err => console.error("AI Comment API Error:", err));
    
        } catch (error) {
            console.error("Error saving comment:", error);
        }
    });
    
    socket.on("livequestions", async (data) => {
        try {
            io.emit("liveaddquestion", {
                questions: data.questions,
            });
    
            await liveMongo.findByIdAndUpdate(
                data.liveId,
                { $push: { Questions: data.questions } }
            );
    
        } catch (err) {
            console.error("Error saving question:", err);
        }
    });
    
    socket.on("join-room", (roomId, userType) => {
            socket.join(roomId);
            if (!rooms[roomId]) rooms[roomId] = [];
            rooms[roomId].push({ id: socket.id, type: userType });
    
            socket.to(roomId).emit("new-user", socket.id, userType);
            socket.to(roomId).emit("user-connected"); 
    });

    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);
       io.to(roomId).emit("user-disconnected", socket.id);
    });
        
    socket.on("offer", (offer, receiverId) => {
        io.to(receiverId).emit("offer", offer, socket.id);
    });
    
    socket.on("answer", (answer, senderId) => {
        io.to(senderId).emit("answer", answer, socket.id);
    });
    
    socket.on("ice-candidate", (candidate, receiverId) => {
        io.to(receiverId).emit("ice-candidate", candidate, socket.id);
    });      

    socket.on("join_room", (roomId) => {
        socket.join(roomId);
    });
    
    socket.on("send_otp", (data) => {
        const { otp, roomId } = data;
    
        socket.to(roomId).emit("receive_otp", { otp });
    });

    socket.on("verify_otp", (data) => {
        const { enteredOTP, roomId } = data;
    
        io.to(roomId).emit("otp_success");
    });
    
    socket.on("end_call_redirect", ({ roomId }) => {
        io.to(roomId).emit("redirect_to_home");
    });        

    socket.on("disconnect", () => {
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter(user => user.id !== socket.id);
            io.to(roomId).emit("user-disconnected", socket.id);
        }
    });
});

server.listen(3000, () => { console.log("listening on port 3000") });