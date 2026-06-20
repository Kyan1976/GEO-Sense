import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  image?: string;
  emailVerified?: Date;
  provider?: string;
  role: "admin" | "user";
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, select: false }, // 审计 I10：默认不返回哈希，需显式 .select('+password')
    image: { type: String },
    emailVerified: { type: Date },
    provider: { type: String, default: "credentials" },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    passwordChangedAt: { type: Date }, // 审计 I3：改密时间戳，用于 JWT 旋转校验
  },
  {
    timestamps: true,
    // 审计 I10：序列化时剥离 password，纵深防御
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

UserSchema.index({ email: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
