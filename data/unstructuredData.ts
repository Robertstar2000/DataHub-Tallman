export interface UnstructuredDocument {
  id: string;
  name: string;
  type: string;
  content: string;
}

export const unstructuredData: UnstructuredDocument[] = [
  {
    id: 'review-01',
    name: 'Review for CloudBook Pro',
    type: 'Product Review',
    content: `
      From: alice@example.com
      Date: 2023-02-20
      Rating: 4/5 Stars
      Title: Great laptop, minor complaint
      
      The CloudBook Pro is amazing for my development work. The screen is crisp and the keyboard is a joy to type on. My only issue is that the battery life, while good, doesn't quite live up to the advertised 12 hours. I'm getting closer to 8-9 hours with my typical workload. I would still recommend it.
    `,
  },
  {
    id: 'ticket-01',
    name: 'Ticket #8341 - Order #104',
    type: 'Support Ticket',
    content: `
      Customer: Charlie Brown (charlie@example.com)
      Order ID: 104
      Product: Mechanic Keyboard
      Date Opened: 2023-01-22

      Issue: My Mechanic Keyboard arrived with a sticky left shift key. It's really hard to press. I've tried cleaning it but it doesn't help. Can I get a replacement sent out?
    `,
  },
  {
    id: 'meeting-01',
    name: 'Q1 Sales Strategy Meeting',
    type: 'Meeting Notes',
    content: `
      Date: 2023-01-05
      Attendees: Sales Team, Marketing Lead
      
      Agenda:
      1. Review Q4 2022 Performance
      2. Set Q1 2023 Targets
      3. Brainstorm new marketing campaigns for the 4K Monitor.

      Key Takeaways:
      - Q4 sales exceeded targets by 15%, driven by the CloudBook Pro.
      - Bob Smith noted a drop in Quantum Mouse sales, needs investigation.
      - Marketing will launch a "Work From Home Pro" bundle (4K Monitor + Mechanic Keyboard).
      - Action Item (Bob): Analyze Quantum Mouse sales data and report back by next week.
      - Action Item (Diana): Draft proposal for the new WFH bundle campaign.
    `,
  },
];