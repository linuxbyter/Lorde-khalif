import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#000814] flex items-center justify-center p-4">
      <div className="border border-gold/20 p-2 bg-navy rounded-xl shadow-2xl shadow-gold/5">
        <SignIn />
      </div>
    </div>
  );
}
