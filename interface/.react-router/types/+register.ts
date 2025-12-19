import "react-router";

declare module "react-router" {
  interface Register {
    params: Params;
  }
}

type Params = {
  "/": {};
  "/login": {};
  "/note": {};
  "/note/edit/:id?": {
    "id"?: string;
  };
  "/setting": {};
};