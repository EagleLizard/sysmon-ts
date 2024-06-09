
import { PorterStemmer, SentimentAnalyzer } from 'natural';
import { ParsedArgv2 } from '../parse-argv';

export async function nlpMain(parsedArgv: ParsedArgv2) {
  console.log('~ nlp');

  let analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
  let text = 'This is a strictly factual statement.';

  let res = analyzer.getSentiment(text.split(' '));
  console.log({
    text,
    res,
  });
}
