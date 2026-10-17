// /beta/membership: the same Notion embed as /membership, in the beta shell.
import type { Metadata } from 'next';
import { ClubEmbed } from '../_components/club/ClubEmbed';
import '../_components/club/club.css';

export const metadata: Metadata = { title: 'Membership' };

export default function BetaMembership() {
  return (
    <ClubEmbed
      title="Membership"
      sub="Sign up as a member of St Antony's Boat Club."
      label="Membership sign-up form"
      src="https://stantonysboatclub.notion.site/ebd/23d80040a8fa80b6a200eacaf389bedf"
    />
  );
}
