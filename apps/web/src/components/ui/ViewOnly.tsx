/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the read-only surface context that marks a subtree as view-only and gates its mutating controls.
*/
import { createContext, useContext, type ReactNode } from "react";

export interface ViewOnlyState {
  readOnly: boolean;
  reason?: string;
}

const ViewOnlyContext = createContext<ViewOnlyState>({ readOnly: false });

export function ViewOnlyProvider({
  readOnly,
  reason,
  children,
}: {
  readOnly: boolean;
  reason?: string;
  children: ReactNode;
}) {
  return (
    <ViewOnlyContext.Provider value={{ readOnly, reason }}>{children}</ViewOnlyContext.Provider>
  );
}

// Reads the nearest read-only surface. The default is interactive, so a control outside any
// provider is never accidentally disabled — only a subtree explicitly marked read-only gates its
// mutating controls.
export function useViewOnly(): ViewOnlyState {
  return useContext(ViewOnlyContext);
}

export const READ_ONLY_BLOCK_MESSAGE = "Read-only view — changes are disabled here.";
