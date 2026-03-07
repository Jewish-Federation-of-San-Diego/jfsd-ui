import { Alert } from "antd";

interface DashboardErrorStateProps {
  message: string;
  description?: string | null;
}

export function DashboardErrorState({ message, description }: DashboardErrorStateProps) {
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      description={description ?? "Please retry in a moment."}
      style={{ margin: 24 }}
    />
  );
}
