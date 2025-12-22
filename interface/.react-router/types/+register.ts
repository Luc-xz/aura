import "react-router";

declare module "react-router" {
  interface Register {
    params: Params;
  }
}

type Params = {
  "/": {};
  "/login": {};
  "/chat": {};
  "/note": {};
  "/note/edit/:id?": {
    "id"?: string;
  };
  "/setting": {};
};