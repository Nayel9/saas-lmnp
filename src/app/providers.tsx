"use client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <MantineProvider defaultColorScheme="light">
            <Notifications />
            {children}
        </MantineProvider>
    );
}
