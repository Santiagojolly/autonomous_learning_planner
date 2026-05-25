import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { GraduationCap, Mail, Lock, Chrome, Apple } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "", general: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    const newErrors = { email: "", password: "", general: "" };
    if (!email) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    
    if (newErrors.email || newErrors.password) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({ email: "", password: "", general: "" });

    try {
      console.log("=== LOGIN ATTEMPT ===");
      console.log("Email:", email);
      await signIn(email, password);
      console.log("=== LOGIN SUCCESS ===");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("=== LOGIN FAILED ===", error);
      setErrors({ 
        email: "", 
        password: "", 
        general: error.message || "Invalid email or password. Please try again." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Illustration/Gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 items-center justify-center p-12">
        <div className="text-white max-w-md">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-2xl backdrop-blur-md border border-white/20">
              <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center relative">
                 <div className="w-2 h-2 bg-white rounded-sm rotate-45 animate-pulse" />
              </div>
            </div>
            <h1 className="text-5xl font-bold tracking-tighter">HALO</h1>
          </div>
          <p className="text-2xl mb-4 font-medium italic opacity-90">"The Autonomous Learning Core"</p>
          <p className="text-indigo-100 text-lg leading-relaxed opacity-80">
            Harness the power of three specialized AI agents to architect, schedule, and heal your learning journey.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white">
                <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-sm rotate-45" />
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tighter">HALO</h1>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
            <h2 className="text-3xl mb-2">Welcome back</h2>
            <p className="text-muted-foreground mb-8">Sign in to continue your learning journey</p>

            {/* Social Login */}
            <div className="space-y-3 mb-6">
              <Button variant="outline" className="w-full" type="button">
                <Chrome className="mr-2 h-5 w-5" />
                Continue with Google
              </Button>
              <Button variant="outline" className="w-full" type="button">
                <Apple className="mr-2 h-5 w-5" />
                Continue with Apple
              </Button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-input-background"
                  />
                </div>
                {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-input-background"
                  />
                </div>
                {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="rounded" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              {errors.general && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-destructive text-sm">{errors.general}</p>
                </div>
              )}
            </form>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}