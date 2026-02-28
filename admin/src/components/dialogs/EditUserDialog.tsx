import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UserRole = 'admin' | 'dispatcher' | 'pilot';
type UserStatus = 'active' | 'suspended' | 'deleted';

interface AdminUserProfile {
  id: number;
  email: string;
  callsign: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  rank: string;
  hoursTotal: number;
  status: UserStatus;
  lastLogin: string | null;
  forcePasswordReset: boolean;
  simbriefUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EditUserDialogProps {
  user: AdminUserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditUserDialog({ user, open, onOpenChange, onUpdated }: EditUserDialogProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [role, setRole] = useState<string>('pilot');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Populate form when user changes
  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setCallsign(user.callsign);
      setRole(user.role);
      setPassword('');
    }
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!email || !firstName || !lastName || !callsign || !role) {
      toast.error('All fields except password are required');
      return;
    }

    const body: Record<string, unknown> = {
      email,
      firstName,
      lastName,
      callsign,
      role,
    };

    // Only include password if the user typed one
    if (password) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      body.password = password;
    }

    setSubmitting(true);
    try {
      await api.patch(`/api/admin/users/${user.id}`, body);
      toast.success('User updated successfully');
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update details for <span className="font-semibold text-foreground">{user?.callsign}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First Name</Label>
              <Input
                id="edit-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last Name</Label>
              <Input
                id="edit-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">
              Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>
            </Label>
            <Input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (optional)"
              minLength={8}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-callsign">Callsign</Label>
              <Input
                id="edit-callsign"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pilot">Pilot</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
