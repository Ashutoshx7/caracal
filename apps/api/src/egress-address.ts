// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Normalizes and classifies egress addresses that outbound requests must never reach.

import { BlockList, isIP } from 'node:net'

const alwaysBlocked = new BlockList()
alwaysBlocked.addSubnet('0.0.0.0', 8, 'ipv4')
alwaysBlocked.addSubnet('127.0.0.0', 8, 'ipv4')
alwaysBlocked.addSubnet('169.254.0.0', 16, 'ipv4')
alwaysBlocked.addSubnet('224.0.0.0', 4, 'ipv4')
alwaysBlocked.addSubnet('240.0.0.0', 4, 'ipv4')
alwaysBlocked.addAddress('::', 'ipv6')
alwaysBlocked.addAddress('::1', 'ipv6')
alwaysBlocked.addSubnet('fe80::', 10, 'ipv6')
alwaysBlocked.addSubnet('ff00::', 8, 'ipv6')

const privateBlocked = new BlockList()
privateBlocked.addSubnet('10.0.0.0', 8, 'ipv4')
privateBlocked.addSubnet('100.64.0.0', 10, 'ipv4')
privateBlocked.addSubnet('172.16.0.0', 12, 'ipv4')
privateBlocked.addSubnet('192.168.0.0', 16, 'ipv4')
privateBlocked.addSubnet('fc00::', 7, 'ipv6')

// Extract the IPv4 address embedded in a NAT64 well-known-prefix address
// (64:ff9b::/96, RFC 6052), or null when value is not such an address.
function nat64EmbeddedIpv4(value: string): string | null {
  const lower = value.toLowerCase()
  if (!lower.startsWith('64:ff9b::')) return null
  const tail = lower.slice('64:ff9b::'.length)
  if (tail === '') return null
  if (tail.includes('.')) return isIP(tail) === 4 ? tail : null
  const groups = tail.split(':')
  if (groups.length < 2) return null
  const hi = Number.parseInt(groups.at(-2)!, 16)
  const lo = Number.parseInt(groups.at(-1)!, 16)
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi > 0xffff || lo > 0xffff) return null
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

export function normalizedUrlHostname(url: URL): string {
  return url.hostname.startsWith('[') && url.hostname.endsWith(']') ? url.hostname.slice(1, -1) : url.hostname
}

export function isUnsafeEgressAddress(value: string, privateAllowed = false): boolean {
  const nat64 = nat64EmbeddedIpv4(value)
  if (nat64) return isUnsafeEgressAddress(nat64, privateAllowed)

  const version = isIP(value)
  if (version === 0) return true
  const family = version === 4 ? 'ipv4' : 'ipv6'
  return alwaysBlocked.check(value, family) || (!privateAllowed && privateBlocked.check(value, family))
}
