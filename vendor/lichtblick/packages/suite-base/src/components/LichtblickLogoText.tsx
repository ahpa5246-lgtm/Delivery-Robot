// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function LichtblickLogoText(props: SvgIconProps): React.JSX.Element {
  return (
    <SvgIcon viewBox="0 0 140 48" {...props}>
      <title>mina</title>
      <text x="70" y="37" textAnchor="middle" fill="currentColor" fontFamily="sans-serif" fontWeight="700" fontSize="44">mina</text>
    </SvgIcon>
  );
}
