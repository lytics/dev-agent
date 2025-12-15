/**
 * React component fixture for adapter tests
 */

interface Props {
  name: string;
  onUpdate?: () => void;
}

export function UserCard({ name, onUpdate }: Props) {
  return (
    <div>
      <h1>{name}</h1>
      <button type="button" onClick={onUpdate}>
        Update
      </button>
    </div>
  );
}
