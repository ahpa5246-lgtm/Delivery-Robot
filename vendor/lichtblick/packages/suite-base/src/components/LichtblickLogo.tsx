// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export function LichtblickLogo(props: SvgIconProps): React.JSX.Element {
  return (
    <SvgIcon viewBox="0 0 32 32" {...props}>
      <title>mina</title>
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M7 23V12h4v2c2-3 5-3 7 0 3-4 7-2 7 2v7h-4v-6c0-2-3-2-3 0v6h-4v-6c0-2-3-2-3 0v6Z" fill="white" />
    </SvgIcon>
  );
}
