/**
 * React Component Example
 *
 * Demonstrates React best practices:
 * - ESM imports
 * - TypeScript interfaces for props
 * - Hooks in proper order
 * - Full type annotations
 */

import { useCallback, useEffect, useState } from 'react';
import type { User } from './types';

interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

/**
 * User profile component with data fetching
 */
export function UserProfile({ userId, onUpdate }: UserProfileProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser(): Promise<void> {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [userId]);

  const handleUpdate = useCallback(
    (updatedUser: User) => {
      setUser(updatedUser);
      onUpdate?.(updatedUser);
    },
    [onUpdate]
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <button type="button" onClick={() => handleUpdate(user)}>
        Update
      </button>
    </div>
  );
}
