
import { PorterStemmer, SentimentAnalyzer } from 'natural';
import { SysmonCommand } from '../sysmon-args';

export async function nlpMain(cmd: SysmonCommand) {
  console.log('~ nlp');

  let analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
  let text = 'This is a strictly factual statement.';

  let res = analyzer.getSentiment(text.split(' '));
  console.log({
    text,
    res,
  });
}
