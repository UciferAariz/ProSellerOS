export interface DemoUser {
  name: string;
  email: string;
  role: string;
  org: string;
  plan: string;
}

export const DEMO_USER: DemoUser = {
  name: "Alex Morgan",
  email: "alex@northwind.co",
  role: "Owner",
  org: "Northwind Commerce",
  plan: "Scale",
};

export const ORGS = [
  { id: "northwind", name: "Northwind Commerce", plan: "Scale" },
  { id: "aurelia", name: "Aurelia Brands", plan: "Growth" },
  { id: "terra", name: "Terra Goods Co.", plan: "Starter" },
];
