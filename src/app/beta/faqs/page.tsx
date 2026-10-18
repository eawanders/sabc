// /beta/faqs: the same Notion embed as /faqs, in the beta shell.
import type { Metadata } from 'next';
import { ClubEmbed } from '../_components/club/ClubEmbed';
import '../_components/club/club.css';

export const metadata: Metadata = { title: 'FAQs' };

export default function BetaFaqs() {
  return (
    <ClubEmbed
      title="FAQs"
      sub="Answers to common questions about the club."
      label="SABC FAQs"
      src="https://stantonysboatclub.notion.site/ebd/28080040a8fa80d5a2e4fee3d8cb2ef6"
    />
  );
}
