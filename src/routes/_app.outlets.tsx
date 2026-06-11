import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/_app/outlets")({ component: () => <Outlet /> });
