const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({    
    username: String,
    email: String,
    password: String,
    fcmToken: String,
    Mobile: String,
    profile: String,
    communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],
    podcast: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "podcasts"
    }],
    vedio: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "vedio"
    }],
    followers: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' 
    }],
    following: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' 
    }],
    Live: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "live"
    }],
    requests: [
        {
            OpponentName: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
            requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'live' },
            creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            title: String,
            description: String,
            status: { type: String, default: 'pending' },
            DebateSupport: { type: String, enum: ['Support', 'Against']},
            Time: String,
        }
    ],
    Sender:  [
        {
            OpponentName: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
            requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'live' },
            creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            title: String,
            description: String,
            status: { type: String, default: 'pending' },
            DebateSupport: { type: String, enum: ['Support', 'Against']},
            Time: String,
        }
    ],
    LiveBooked: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'live'
    }],
    MunCompetition: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Competition'
    }],
    Rank: {
        type: Number,
        default: 0
    },
    Rankpoints: {
        type: Number,
        default: 0
    },
    UserWatchHours: [{
        type: Number,
        default: 0
    }],
    SEOTags: [String],
    notification: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'notification'
    }]
});

userSchema.statics.updateRanks = async function () {
    try {
        const users = await this.find().sort({ Rankpoints: -1 }); // Sort by Rankpoints
        let rank = 1;
        for (let user of users) {
            user.Rank = rank++; // Assign rank
            await user.save();  // Save each user
        }
    } catch (err) {
        console.error("Error updating ranks:", err);
        throw err;
    }
};

module.exports = mongoose.model('User', userSchema);
