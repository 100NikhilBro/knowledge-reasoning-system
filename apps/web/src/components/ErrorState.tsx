interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="error-banner" role="alert">
      {message}
    </div>
  );
}
