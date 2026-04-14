export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
