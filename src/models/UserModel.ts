import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    passwordHash: string;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    passwordResetToken: {
        type: String,
        default: null,
    },
    passwordResetExpires: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for faster email lookups
UserSchema.index({ email: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);

