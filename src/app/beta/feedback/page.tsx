// /beta/feedback: the same Notion embed as /feedback, in the beta shell.
import type { Metadata } from 'next';
import { ClubEmbed } from '../_components/club/ClubEmbed';
import '../_components/club/club.css';

export const metadata: Metadata = { title: 'Feedback' };

export default function BetaFeedback() {
  return (
    <ClubEmbed
      title="Feedback"
      sub="Tell the committee what is working and what isn't."
      label="SABC feedback form"
      src="https://stantonysboatclub.notion.site/ebd/24e80040a8fa8035bec2c5387a981512"
    />
  );
}
