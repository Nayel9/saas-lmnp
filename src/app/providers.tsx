"use client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <MantineProvider defaultColorScheme="light">
                <Notifications />
                {children}
            </MantineProvider>
        </SessionProvider>
    );
}
