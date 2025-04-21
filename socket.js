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
const db = require("./config/mongoose-connection");
const { GoogleGenAI } = require('@google/genai');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "https://clartalk.online",
        methods: ['GET', 'POST']
    }
});





const rooms = {}; 

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
            // 1. Emit user's message
            io.emit("chatMessage", data);
    
            // 2. Save user's message
            const newMessage = new Message({
                Message: data.message,
                sender: data.username
            });
            await newMessage.save();
    
            // 3. Add message to community
            await Community.findByIdAndUpdate(
                data.communityId,
                { $push: { Messages: newMessage._id } }
            );
    
            // 4. AI Setup
            const ai = new GoogleGenAI({ apiKey: "AIzaSyD5uAolO0dkW61LQbGjTjOavsDy78-rejU" });
    
            const supportUsers = ["Ravi", "Ankit", "Priya"];
            const againstUsers = ["Soni", "Alok", "Simran"];
    
            const randomSupportUser = supportUsers[Math.floor(Math.random() * supportUsers.length)];
            const randomAgainstUser = againstUsers[Math.floor(Math.random() * againstUsers.length)];
    
            // 5. Get last N messages (adjust the number if needed, e.g., 5-10 messages)
            const contextMessages = await Message.find({ communityId: data.communityId })
                .sort({ createdAt: -1 })
                .limit(10); // or adjust the limit here
    
            // 6. Prepare chat context from last N messages
            const chatContext = contextMessages.reverse().map(msg => ({
                role: msg.sender === data.username ? "user" : "model",
                parts: [{ text: msg.Message }]
            }));
    
            // Add the current message from the user to the context
            chatContext.push({
                role: "user",
                parts: [{ text: data.message }]
            });
    
            // 7. Define Prompts (support and against)
            const promptSupport = `
                You're in a group debate chat behaving like a real person in Roman Hindi
                Talk casually and supportively like a friend
                If someone makes a good point say something chill like haan bhai sahi bola ya bilkul agree hu ya mast baat boli tune ya solid point bro
                If someone just says hello or hi reply warm and casual like hello bhai kya scene ya haan bro kya haal ya kya mast entry maar di tu
                Always sound like a real person never repeat same phrases again and again add thoda variation
                Reply in 1 or 2 lines no punctuation no quotes just chat style
            `;
    
            const promptAgainst = `
                You're in a heated group debate acting like a real savage street-smart debater in Roman Hindi
                If the message is weak or boring roast it with style like yeh bolke khush hua kya ya bhai tu debate mein ya drama class mein ya aisa slow logic toh traffic bhi overtake kar le
                If someone just says hello ya hi mock them in funny way like hello se kya karishma karna hai ya sirf hello bolne aaya ya greeting bheja aur point bhool gaya kya
                Make sure replies are always different and unpredictable never repeat same line again and again
                Use only 1 or 2 lines talk like real chat no punctuation no quotes just attitude
            `;
    
            // 8. Generate Initial AI Support & Against Replies
            const [responseSupport, responseAgainst] = await Promise.all([
                ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: [
                        { role: "user", parts: [{ text: promptSupport }] },
                        ...chatContext
                    ],
                    generationConfig: {
                        temperature: 1.2,
                        topP: 0.9
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
                        topP: 0.9
                    },
                }),
            ]);
    
            const aiReplySupport = responseSupport?.text?.replace(/\\"/g, '"').trim();
            const aiReplyAgainst = responseAgainst?.text?.replace(/\\"/g, '"').trim();
    
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
    
            await Community.findByIdAndUpdate(
                data.communityId,
                { $push: { Messages: { $each: [aiMessageAgainst._id, aiMessageSupport._id] } } }
            );
    
            // Emit the 2 initial AI messages
            setTimeout(() => {
                io.emit("chatMessage", {
                    username: randomSupportUser,
                    message: aiReplySupport,
                    communityId: data.communityId
                });
            }, 2000);
    
            io.emit("chatMessage", {
                username: randomAgainstUser,
                message: aiReplyAgainst,
                communityId: data.communityId
            });
    
            // 9. Recursive AI Debate Loop
            async function aiDebateLoop(contextMessages, communityId, turn = 0, maxTurns = 15) {
                if (turn >= maxTurns) return;
    
                const isSupportTurn = turn % 2 === 0;
                const prompt = isSupportTurn ? promptSupport : promptAgainst;
                const randomUser = isSupportTurn
                    ? supportUsers[Math.floor(Math.random() * supportUsers.length)]
                    : againstUsers[Math.floor(Math.random() * againstUsers.length)];
    
                const response = await ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: [
                        { role: "user", parts: [{ text: prompt }] },
                        ...contextMessages
                    ],
                    generationConfig: {
                        temperature: 1.2,
                        topP: 0.9
                    },
                });
    
                const aiReply = response?.text?.replace(/\\"/g, '"').trim();
    
                const aiMessage = new Message({
                    Message: aiReply,
                    sender: randomUser,
                });
                await aiMessage.save();
    
                await Community.findByIdAndUpdate(
                    communityId,
                    { $push: { Messages: aiMessage._id } }
                );
    
                io.emit("chatMessage", {
                    username: randomUser,
                    message: aiReply,
                    communityId: communityId
                });
    
                contextMessages.push({
                    role: isSupportTurn ? "user" : "model",
                    parts: [{ text: aiReply }]
                });
    
                setTimeout(() => {
                    aiDebateLoop(contextMessages, communityId, turn + 1, maxTurns);
                }, 3000);
            }
    
            // Start the AI Debate Loop after a short delay
            setTimeout(() => {
                aiDebateLoop([...chatContext], data.communityId);
            }, 4000);
    
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