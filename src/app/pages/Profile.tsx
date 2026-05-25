import { useState, useEffect } from "react";
import { User, Mail, Calendar, Target, Bell, Moon, Lock, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Separator } from "../components/ui/separator";
import { useAuth } from "../context/AuthContext";
import { API } from "../lib/api";
import { toast } from "sonner";

export function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    joinDate: "",
    weeklyGoal: "30",
    dailyGoal: "5",
  });

  const [notifications, setNotifications] = useState({
    studyReminders: true,
    weeklyReports: true,
    aiInsights: true,
  });

  const [darkMode, setDarkMode] = useState(false);

  // Load profile data from backend
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await API.getProfile();
      setProfile({
        name: data.profile.name || user?.name || "",
        email: data.profile.email || user?.email || "",
        joinDate: new Date(data.profile.joinDate).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        }),
        weeklyGoal: data.profile.weeklyGoal?.toString() || "30",
        dailyGoal: data.profile.dailyGoal?.toString() || "5",
      });
    } catch (error) {
      console.error("Failed to load profile:", error);
      // Fallback to user data from auth context
      if (user) {
        setProfile({
          name: user.name || "",
          email: user.email || "",
          joinDate: "February 2026",
          weeklyGoal: "30",
          dailyGoal: "5",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await API.saveProfile({
        name: profile.name,
        email: profile.email,
        weeklyGoal: parseInt(profile.weeklyGoal),
        dailyGoal: parseInt(profile.dailyGoal),
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (profile.name) {
      const parts = profile.name.split(' ');
      if (parts.length >= 2) {
        return parts[0][0] + parts[1][0];
      }
      return parts[0][0];
    }
    return "U";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl mb-2">Profile & Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">
                Change Photo
              </Button>
              <p className="text-sm text-muted-foreground mt-2">JPG, PNG or GIF, max 2MB</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Member Since
              </Label>
              <Input value={profile.joinDate} disabled className="mt-2" />
            </div>
          </div>

          <Separator />

          <Button onClick={handleSaveProfile}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Study Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Study Goals
          </CardTitle>
          <CardDescription>Set your weekly and daily study targets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="weekly-goal">Weekly Study Hours</Label>
              <Input
                id="weekly-goal"
                type="number"
                value={profile.weeklyGoal}
                onChange={(e) => setProfile({ ...profile, weeklyGoal: e.target.value })}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">Recommended: 25-35 hours</p>
            </div>

            <div>
              <Label htmlFor="daily-goal">Daily Study Hours</Label>
              <Input
                id="daily-goal"
                type="number"
                value={profile.dailyGoal}
                onChange={(e) => setProfile({ ...profile, dailyGoal: e.target.value })}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">Recommended: 4-6 hours</p>
            </div>
          </div>

          <Button onClick={handleSaveProfile}>
            <Save className="h-4 w-4 mr-2" />
            Update Goals
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Choose what notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="study-reminders">Study Session Reminders</Label>
                <p className="text-sm text-muted-foreground">Reminders to start your planned study sessions</p>
              </div>
              <Switch
                id="study-reminders"
                checked={notifications.studyReminders}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, studyReminders: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="weekly-reports">Weekly Progress Reports</Label>
                <p className="text-sm text-muted-foreground">Receive weekly summaries of your progress</p>
              </div>
              <Switch
                id="weekly-reports"
                checked={notifications.weeklyReports}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, weeklyReports: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ai-insights">AI Insights & Recommendations</Label>
                <p className="text-sm text-muted-foreground">Get personalized study tips from AI</p>
              </div>
              <Switch
                id="ai-insights"
                checked={notifications.aiInsights}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, aiInsights: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dark-mode">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Enable dark theme for better visibility at night</p>
            </div>
            <Switch
              id="dark-mode"
              checked={darkMode}
              onCheckedChange={(checked) => {
                setDarkMode(checked);
                document.documentElement.classList.toggle("dark");
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your password and security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <Input id="current-password" type="password" placeholder="••••••••" className="mt-2" />
          </div>
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input id="new-password" type="password" placeholder="••••••••" className="mt-2" />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" type="password" placeholder="••••••••" className="mt-2" />
          </div>
          <Button variant="outline">Update Password</Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p>Delete Account</p>
              <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}